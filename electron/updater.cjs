const fs=(process.versions.electron?require('original-fs'):require('node:fs')).promises;
const path=require('node:path');
const {spawn}=require('node:child_process');
const {createHash,randomUUID}=require('node:crypto');
async function verifyInstaller(file,release){const bytes=await fs.readFile(file);if(bytes.length!==release.size||createHash('sha256').update(bytes).digest('hex')!==release.sha256)throw Error('The launcher update failed integrity verification.');}
function updaterScript(){return `param([string]$Plan)
$ErrorActionPreference = 'Stop'
$update = $null
function File-SHA256([string]$File) {
  $stream = [IO.File]::OpenRead($File)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
  finally { $stream.Dispose(); $sha.Dispose() }
}
try {
  $update = Get-Content -LiteralPath $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
  @{version=$update.version;phase='started';pid=$PID} | ConvertTo-Json | Set-Content -LiteralPath $update.ready -Encoding UTF8
  Wait-Process -Id $update.pid -Timeout 60 -ErrorAction SilentlyContinue
  if (Get-Process -Id $update.pid -ErrorAction SilentlyContinue) { throw 'The launcher did not close. Close it and retry the update.' }
  $hash = File-SHA256 $update.installer
  if ($hash -ne $update.sha256 -or (Get-Item -LiteralPath $update.installer).Length -ne $update.size) { throw 'Update integrity verification failed' }
  $arguments = @('/S', '--updated', ('/D=' + $update.directory))
  $result = Start-Process -FilePath $update.installer -ArgumentList $arguments -PassThru -WindowStyle Hidden
  if (-not $result.WaitForExit(180000)) { throw 'The installer did not finish within three minutes. Close it and retry.' }
  if ($result.ExitCode -ne 0) { throw ('Installer exited with code ' + $result.ExitCode) }
  if ($update.asarSHA256) {
    $runtime = Join-Path $update.directory 'resources/app.asar'
    if ((File-SHA256 $runtime) -ne $update.asarSHA256) { throw 'The installed launcher did not match the verified release. Retry the update.' }
  }
  @{version=$update.version;success=$true;finishedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $update.result -Encoding UTF8
  Start-Process -FilePath $update.executable -ArgumentList '--updated' -WindowStyle Hidden
} catch {
  if ($update) {
    @{version=$update.version;success=$false;error=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath $update.result -Encoding UTF8
    if ((Test-Path -LiteralPath $update.executable) -and -not (Get-Process -Id $update.pid -ErrorAction SilentlyContinue)) { Start-Process -FilePath $update.executable -ArgumentList '--update-failed' -WindowStyle Hidden }
  }
  exit 1
}
`;}
function helperArguments(script,plan){
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  const command=`& ${quote(script)} -Plan ${quote(plan)}`;
  return ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')];
}
async function applyUpdate({app,installer,release,directory}){
  await verifyInstaller(installer,release);await fs.mkdir(directory,{recursive:true});
  const attempt=randomUUID(),script=path.join(directory,`apply-${attempt}.ps1`),plan=path.join(directory,`apply-${attempt}.json`),ready=path.join(directory,`ready-${attempt}.json`),executable=app.getPath('exe');
  await fs.writeFile(script,updaterScript());await fs.writeFile(plan,JSON.stringify({pid:process.pid,installer,sha256:release.sha256,size:release.size,asarSHA256:release.runtimeIntegrity?.asarSHA256,version:release.version,directory:path.dirname(executable),executable,ready,result:path.join(directory,'last-update.json')}));
  const child=spawn('powershell.exe',helperArguments(script,plan),{detached:true,stdio:'ignore',windowsHide:true});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
  const deadline=Date.now()+10000;let started=false;
  while(Date.now()<deadline){try{const result=JSON.parse((await fs.readFile(ready,'utf8')).replace(/^\uFEFF/,''));if(result.phase==='started'){started=true;break;}}catch{}if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,100));}
  if(!started)throw Error('The update helper could not start. Your launcher is still open; retry the update or reinstall the latest Launcher.');
  app.isQuitting=true;app.quit();
}
module.exports={verifyInstaller,applyUpdate,updaterScript,helperArguments};
