const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {verifyInstaller,applyUpdate}=require('../electron/updater.cjs');
test('the real updater starts from Electron and survives its parent exiting',{skip:process.platform!=='win32'},async()=>{
  const {spawnSync}=require('node:child_process'),{_electron}=require('@playwright/test');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'electron update survival ')),source=path.join(dir,'fixture.cs'),installer=path.join(dir,'setup.exe'),target=path.join(dir,'installed app'),executable=path.join(target,'Launcher.exe');let parent;
  try{
    await fs.mkdir(target);await fs.writeFile(source,'using System; using System.IO; class Fixture { static void Main(string[] args) { if (args.Length == 1 && args[0] == "--updated") return; int i=Array.FindIndex(args,a=>a.StartsWith("/D=")); if(i<0) Environment.Exit(2); string folder=String.Join(" ",args,i,args.Length-i).Substring(3); Directory.CreateDirectory(Path.Combine(folder,"resources")); File.WriteAllText(Path.Combine(folder,"resources","app.asar"),"survived Electron exit"); Directory.CreateDirectory(Path.Combine(folder,"resources","updater")); File.WriteAllText(Path.Combine(folder,"resources","updater","BlueCloudUpdate.exe"),"replacement updater"); } }');
    const build=spawnSync(path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:exe','/out:'+installer,source],{encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(build.status,0,build.stdout+build.stderr);await fs.copyFile(installer,executable);const bundled=path.join(target,'resources/updater/BlueCloudUpdate.exe');await fs.mkdir(path.dirname(bundled),{recursive:true});await fs.copyFile(path.resolve(__dirname,'../build/BlueCloudUpdate.exe'),bundled);
    const fixture=path.join(dir,'parent');await fs.mkdir(fixture);await fs.writeFile(path.join(fixture,'package.json'),JSON.stringify({name:'update-survival-fixture',version:'1.0.0',main:'main.cjs'}));await fs.writeFile(path.join(fixture,'main.cjs'),"const {app,BrowserWindow}=require('electron');app.setPath('userData',process.env.UPDATE_TEST_PROFILE);app.whenReady().then(()=>{new BrowserWindow({show:false}).loadURL('about:blank');});app.on('window-all-closed',()=>app.quit());");
    parent=await _electron.launch({executablePath:require('electron'),args:[fixture],env:{...process.env,UPDATE_TEST_PROFILE:path.join(dir,'profile')}});
    const bytes=await fs.readFile(installer),release={version:'0.6.2',size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),runtimeIntegrity:{asarSHA256:crypto.createHash('sha256').update('survived Electron exit').digest('hex'),updaterSHA256:crypto.createHash('sha256').update('replacement updater').digest('hex')}};
    await parent.evaluate(async({app},data)=>{const load=typeof require==='function'?require:process.getBuiltinModule('module').createRequire(data.module);await load(data.module).applyUpdate({app:{getPath:()=>data.executable,quit:()=>app.quit()},installer:data.installer,release:data.release,directory:data.directory,helperPath:data.helper});},{module:path.resolve(__dirname,'../electron/updater.cjs'),executable,installer,release,helper:bundled,directory:path.join(dir,'updates')}).catch(error=>{if(!/closed|disconnected|destroyed/i.test(error.message))throw error;});
    const result=path.join(dir,'updates/last-update.json'),deadline=Date.now()+15000;let saved;
    while(Date.now()<deadline){try{saved=JSON.parse((await fs.readFile(result,'utf8')).replace(/^\uFEFF/,''));break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
    assert.equal(saved?.success,true,JSON.stringify(saved));assert.equal(await fs.readFile(path.join(target,'resources/app.asar'),'utf8'),'survived Electron exit');
  }finally{await parent?.close().catch(()=>{});await fs.rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
test('native helper acknowledges startup and records integrity failures in paths with spaces and apostrophes',{skip:process.platform!=='win32'},async()=>{
  const {spawnSync}=require('node:child_process');const dir=await fs.mkdtemp(path.join(os.tmpdir(),"launcher helper's test "));
  try{
    const plan=path.join(dir,'update plan.json'),ready=path.join(dir,'ready.json'),result=path.join(dir,'result.json'),installer=path.join(dir,'invalid.exe');
    await fs.writeFile(installer,'changed');await fs.writeFile(plan,JSON.stringify({pid:2147483647,attempt:'integrity-test',installer,sha256:'0'.repeat(64),size:7,version:'0.6.2',directory:dir,executable:path.join(dir,'missing.exe'),ready,result}));
    const run=spawnSync(path.resolve(__dirname,'../build/BlueCloudUpdate.exe'),['--plan',plan],{windowsHide:true,encoding:'utf8',timeout:10000});
    assert.equal(run.status,1,run.stderr);assert.equal(JSON.parse(await fs.readFile(ready,'utf8')).phase,'started');const saved=JSON.parse(await fs.readFile(result,'utf8'));assert.equal(saved.success,false);assert.match(saved.error,/integrity verification/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('installer tampering or a missing helper cannot close the launcher',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'updater-verify-'));let quit=false;
  try{
    const installer=path.join(dir,'setup.exe'),bytes=Buffer.from('verified installer fixture'),release={size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
    await fs.writeFile(installer,bytes);await verifyInstaller(installer,release);await fs.writeFile(installer,'changed');await assert.rejects(()=>verifyInstaller(installer,release),/integrity verification/);
    await fs.writeFile(installer,bytes);await assert.rejects(()=>applyUpdate({app:{getPath:()=>path.join(dir,'Launcher.exe'),quit:()=>{quit=true;}},installer,release,directory:path.join(dir,'updates'),helperPath:path.join(dir,'missing-helper.exe')}),/helper is missing/);assert.equal(quit,false);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
