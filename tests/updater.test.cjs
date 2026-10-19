const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {verifyInstaller,updaterScript}=require('../electron/updater.cjs');
test('Windows helper completes an installer process, verifies installed bytes and records success',{skip:process.platform!=='win32'},async()=>{
  const {spawnSync}=require('node:child_process'),{helperArguments}=require('../electron/updater.cjs');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'launcher installer integration '));
  try{
    const source=path.join(dir,'fixture.cs'),installer=path.join(dir,'setup.exe'),destination=path.join(dir,'installed app'),executable=path.join(destination,'Launcher.exe');
    await fs.mkdir(destination);
    await fs.writeFile(source,'using System; using System.IO; class Fixture { static void Main(string[] args) { if (args.Length == 1 && args[0] == "--updated") return; int i=Array.FindIndex(args, a => a.StartsWith("/D=")); if (i<0) Environment.Exit(2); string folder=String.Join(" ",args,i,args.Length-i).Substring(3); Directory.CreateDirectory(Path.Combine(folder,"resources")); File.WriteAllText(Path.Combine(folder,"resources","app.asar"),"new installed runtime"); } }');
    const compiler=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
    const build=spawnSync(compiler,['/nologo','/target:exe','/out:'+installer,source],{encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(build.status,0,build.stdout+build.stderr);
    await fs.copyFile(installer,executable);const bytes=await fs.readFile(installer),script=path.join(dir,'apply.ps1'),plan=path.join(dir,'plan.json'),result=path.join(dir,'result.json');
    await fs.writeFile(script,updaterScript());await fs.writeFile(plan,JSON.stringify({pid:2147483647,installer,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),size:bytes.length,asarSHA256:crypto.createHash('sha256').update('new installed runtime').digest('hex'),version:'0.6.0',directory:destination,executable,ready:path.join(dir,'ready.json'),result}));
    const run=spawnSync('powershell.exe',helperArguments(script,plan),{encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse((await fs.readFile(result,'utf8')).replace(/^\uFEFF/,'')).success,true);assert.equal(await fs.readFile(path.join(destination,'resources/app.asar'),'utf8'),'new installed runtime');
  }finally{await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
test('Windows helper acknowledges startup and records integrity failures in paths with spaces and apostrophes',{skip:process.platform!=='win32'},async()=>{
  const {spawnSync}=require('node:child_process'),{helperArguments}=require('../electron/updater.cjs');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"launcher helper's test "));
  try{
    const script=path.join(dir,'apply update.ps1'),plan=path.join(dir,'update plan.json'),ready=path.join(dir,'ready.json'),result=path.join(dir,'result.json'),installer=path.join(dir,'invalid.exe');
    await fs.writeFile(script,updaterScript());await fs.writeFile(installer,'changed');
    await fs.writeFile(plan,JSON.stringify({pid:2147483647,installer,sha256:'0'.repeat(64),size:7,version:'0.6.0',directory:dir,executable:path.join(dir,'missing.exe'),ready,result}));
    const process=spawnSync('powershell.exe',helperArguments(script,plan),{windowsHide:true,encoding:'utf8',timeout:20000});
    assert.equal(process.status,1,process.stderr);const read=async file=>JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
    assert.equal((await read(ready)).phase,'started');assert.equal((await read(result)).success,false);assert.match((await read(result)).error,/integrity verification/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('launcher update verifies the installer again before execution and after launcher exit',async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bluecloud-update-test-'));try{const file=path.join(dir,'setup.exe'),bytes=Buffer.from('verified installer fixture'),release={size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};await fs.writeFile(file,bytes);await verifyInstaller(file,release);await fs.writeFile(file,Buffer.from('modified installer fixture'));await assert.rejects(()=>verifyInstaller(file,release),/integrity verification/);const script=updaterScript();assert.ok(script.indexOf('Wait-Process')<script.indexOf('Start-Process'));assert.match(script,/ComputeHash/);assert.match(script,/\/S/);assert.match(script,/--updated/);assert.match(script,/ExitCode -ne 0/);}finally{await fs.rm(dir,{recursive:true,force:true});}});
