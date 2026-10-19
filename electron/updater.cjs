const fs=(process.versions.electron?require('original-fs'):require('node:fs')).promises;
const path=require('node:path');
const {spawn}=require('node:child_process');
const {createHash}=require('node:crypto');
async function verifyInstaller(file,release){const bytes=await fs.readFile(file);if(bytes.length!==release.size||createHash('sha256').update(bytes).digest('hex')!==release.sha256)throw Error('The launcher update failed integrity verification.');}
function updaterScript(){return `param([string]$Plan)
$ErrorActionPreference = 'Stop'
$update = Get-Content -LiteralPath $Plan -Raw | ConvertFrom-Json
try {
  Wait-Process -Id $update.pid -ErrorAction SilentlyContinue
  $hash = (Get-FileHash -LiteralPath $update.installer -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $update.sha256 -or (Get-Item -LiteralPath $update.installer).Length -ne $update.size) { throw 'Update integrity verification failed' }
  $arguments = @('/S', '--updated', '--force-run', ('/D=' + $update.directory))
  $result = Start-Process -FilePath $update.installer -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
  if ($result.ExitCode -ne 0) { throw ('Installer exited with code ' + $result.ExitCode) }
  @{version=$update.version;success=$true} | ConvertTo-Json | Set-Content -LiteralPath $update.result
  if (-not (Get-Process -Name 'BlueCloud Launcher' -ErrorAction SilentlyContinue)) { Start-Process -FilePath $update.executable }
} catch {
  @{version=$update.version;success=$false;error=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath $update.result
}
`;}
async function applyUpdate({app,installer,release,directory}){
  await verifyInstaller(installer,release);await fs.mkdir(directory,{recursive:true});
  const script=path.join(directory,'apply-update.ps1'),plan=path.join(directory,'apply-update.json'),executable=app.getPath('exe');
  await fs.writeFile(script,updaterScript());await fs.writeFile(plan,JSON.stringify({pid:process.pid,installer,sha256:release.sha256,size:release.size,version:release.version,directory:path.dirname(executable),executable,result:path.join(directory,'last-update.json')}));
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',script,'-Plan',plan],{detached:true,stdio:'ignore',windowsHide:true});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();app.isQuitting=true;app.quit();
}
module.exports={verifyInstaller,applyUpdate,updaterScript};
