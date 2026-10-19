const fs=(process.versions.electron?require('original-fs'):require('node:fs')).promises;
const path=require('node:path');
const {spawn}=require('node:child_process');
const {createHash,randomUUID}=require('node:crypto');
async function verifyInstaller(file,release){const bytes=await fs.readFile(file);if(bytes.length!==release.size||createHash('sha256').update(bytes).digest('hex')!==release.sha256)throw Error('The launcher update failed integrity verification.');}
async function applyUpdate({app,installer,release,directory,helperPath}){
  await verifyInstaller(installer,release);await fs.mkdir(directory,{recursive:true});
  const attempt=randomUUID(),plan=path.join(directory,`apply-${attempt}.json`),ready=path.join(directory,`ready-${attempt}.json`),worker=path.join(directory,`apply-${attempt}.exe`),executable=app.getPath('exe');
  const source=helperPath||(app.isPackaged?path.join(process.resourcesPath,'updater/BlueCloudUpdate.exe'):path.join(__dirname,'../build/BlueCloudUpdate.exe'));
  let entry;try{entry=await fs.lstat(source);}catch{throw Error('The update helper is missing. Reinstall the latest Launcher.');}if(!entry.isFile()||entry.isSymbolicLink())throw Error('The update helper is missing. Reinstall the latest Launcher.');
  // Copy outside the installation directory so Windows can replace the bundled
  // helper during installation while this independent worker is running.
  const bytes=await fs.readFile(source);await fs.writeFile(worker,bytes,{flag:'wx'});
  if(createHash('sha256').update(await fs.readFile(worker)).digest('hex')!==createHash('sha256').update(bytes).digest('hex'))throw Error('The update helper could not be staged.');
  await fs.writeFile(plan,JSON.stringify({pid:process.pid,attempt,installer,sha256:release.sha256,size:release.size,asarSHA256:release.runtimeIntegrity?.asarSHA256,updaterSHA256:release.runtimeIntegrity?.updaterSHA256,version:release.version,directory:path.dirname(executable),executable,ready,result:path.join(directory,'last-update.json')}));
  const child=spawn(worker,['--plan',plan],{detached:true,stdio:'ignore',windowsHide:true});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
  const deadline=Date.now()+10000;let started=false;
  while(Date.now()<deadline){try{const result=JSON.parse((await fs.readFile(ready,'utf8')).replace(/^\uFEFF/,''));if(result.phase==='started'&&result.attempt===attempt){started=true;break;}}catch{}if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,100));}
  if(!started)throw Error('The update helper could not start. Your launcher is still open; retry the update or reinstall the latest Launcher.');
  app.isQuitting=true;app.quit();
}
module.exports={verifyInstaller,applyUpdate};
