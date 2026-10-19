const {app,BrowserWindow,ipcMain,Menu,dialog,shell}=require('electron');
const fs=require('original-fs').promises;
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {pathToFileURL}=require('node:url');
const {extractPackage}=require('./extract.cjs');
const semver=require('semver');
const {safePath,trustedDownload,verifyFeed,validAppId}=require('./security.cjs');
const {applyUpdate,verifyInstaller}=require('./updater.cjs');
const {downloadPackage}=require('./download.cjs');
const {createShortcuts}=require('./shortcuts.cjs');
const {createAssociations}=require('./associations.cjs');
const config=require('../config.json');
const products=require('../products.json');
const version=require('../package.json').version;
if(process.env.BLUECLOUD_TEST_PROFILE&&!app.isPackaged)app.setPath('userData',process.env.BLUECLOUD_TEST_PROFILE);
if(app.commandLine.hasSwitch('user-data-dir'))app.setPath('userData',path.resolve(app.commandLine.getSwitchValue('user-data-dir')));
const library=path.join(app.getPath('userData'),'library');
const registryPath=path.join(app.getPath('userData'),'installed.json');
const feedCache=path.join(app.getPath('userData'),'feed.json');
const start=pathToFileURL(path.join(__dirname,'../ui/index.html')).href;
let win,feed=null,installed={},lastError='',highestPublished=0,bulkRemoving=false,pendingUpdate=null,autoUpdate=true,deferUpdate=false,updateTimer;
const appErrors={},updateDirectory=path.join(app.getPath('userData'),'updates');
const isolatedProfile=app.commandLine.hasSwitch('user-data-dir')||Boolean(process.env.BLUECLOUD_TEST_PROFILE);
const shortcutRoot=isolatedProfile?path.join(app.getPath('userData'),'start-menu'):path.join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs','BlueCloud Apps');
const shortcuts=createShortcuts({fs,shell,root:shortcutRoot,library});
const associations=createAssociations({fs,library,enabled:process.platform==='win32'&&!isolatedProfile});
async function syncShortcut(id){try{await shortcuts.sync(id,installed[id],productList().find(p=>p.id===id));await associations.sync(id,installed[id]);}catch(error){await recordError(id,new Error(`App installed, but its Windows integration could not be completed: ${error.message}`));}}
const jobs=new Map(),children=new Map();let saveQueue=Promise.resolve();
const paused=new Set(),downloadDirectory=path.join(library,'.downloads');
const partialFile=r=>path.join(downloadDirectory,`${r.appId}-${r.sha256}.part`);
function saveRegistry(){saveQueue=saveQueue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(registryPath),{recursive:true});await fs.writeFile(registryPath+'.tmp',JSON.stringify(installed,null,2));await fs.rename(registryPath+'.tmp',registryPath);});return saveQueue;}
function sender(event){if(event.sender!==win?.webContents||event.senderFrame?.url.split('#')[0]!==start)throw Error('Untrusted window');}
function idCheck(id){if(!validAppId(id)||!(products.some(p=>p.id===id)||installed[id]||feed?.releases.some(r=>r.appId===id)))throw Error('Unknown app');}
function productList(){const list=[...products];for(const r of feed?.releases||[])if(!list.some(p=>p.id===r.appId))list.push({id:r.appId,name:typeof r.name==='string'?r.name.slice(0,100):r.appId,category:typeof r.category==='string'?r.category.slice(0,80):'BlueCloud app',description:typeof r.description==='string'?r.description.slice(0,1000):'Install and manage this app in your BlueCloud library.',version:r.version,note:r.notes||''});for(const id of Object.keys(installed))if(!list.some(p=>p.id===id))list.push({id,name:id,category:'Installed app',description:'Installed in your BlueCloud library.',version:installed[id].version});return list;}
async function recordError(id,error){appErrors[id]=error.name==='AbortError'?'Cancelled. You can retry this installation.':error.message;await fs.appendFile(path.join(app.getPath('userData'),'operations.log'),JSON.stringify({time:new Date().toISOString(),app:id,error:appErrors[id]})+'\n').catch(()=>{});}
async function openLink(input){idCheck(input?.id);const links={website:'https://bluecloudai.online/',source:`https://github.com/${config.repositories[input.id]||config.repository}`,support:'mailto:sadeeqsgi@icloud.com'};if(!Object.hasOwn(links,input.kind))throw Error('Unknown link');await shell.openExternal(links[input.kind]);return state();}
function emit(id,phase,percent=0){if(!win?.isDestroyed())win?.webContents.send('progress',{id,phase,percent});}
function state(){return{products:productList(),installed,releases:(feed?.releases||[]).map(r=>({...r,requiresLauncher:!semver.gte(version,r.minimumLauncher),updateAvailable:semver.gt(r.version,r.appId==='launcher'?version:installed[r.appId]?.version||r.version)})),version,channel:config.channel,error:lastError,appErrors:{...appErrors},busy:[...jobs.keys()],paused:[...paused],bulkRemoving,autoUpdate,selfUpdate:pendingUpdate?{version:pendingUpdate.release.version,phase:pendingUpdate.phase,deferred:deferUpdate}:null};}
function broadcast(){if(!win?.isDestroyed())win?.webContents.send('state-changed',state());}
async function restartUpdate(){
  if(!pendingUpdate||pendingUpdate.phase!=='ready')return state();
  if(jobs.size||bulkRemoving)throw Error('Wait for downloads and app operations to finish before restarting.');
  clearTimeout(updateTimer);updateTimer=null;deferUpdate=false;pendingUpdate.phase='restarting';broadcast();
  try{await applyUpdate({app,installer:pendingUpdate.file,release:pendingUpdate.release,directory:updateDirectory});}
  catch(error){pendingUpdate.phase='ready';deferUpdate=true;await recordError('launcher',error);broadcast();throw error;}
  return state();
}
function scheduleUpdate(){if(!app.isPackaged||!pendingUpdate||pendingUpdate.phase!=='ready'||!autoUpdate||deferUpdate||updateTimer)return;updateTimer=setTimeout(async()=>{updateTimer=null;if(jobs.size||bulkRemoving){scheduleUpdate();return;}await restartUpdate().catch(()=>{});},15000);}
async function checkSelfUpdate(){if(!app.isPackaged||!autoUpdate||deferUpdate||jobs.has('launcher'))return;const r=feed?.releases.find(r=>r.appId==='launcher'&&semver.gt(r.version,version));if(pendingUpdate){if(r&&r.version===pendingUpdate.release.version&&r.sha256===pendingUpdate.release.sha256){scheduleUpdate();return;}pendingUpdate=null;}if(r)try{await install('launcher');}catch{} }
async function refresh(){
  try{
    const url=new URL('/rest/v1/bluecloud_release_channels',config.supabaseUrl);url.search=new URLSearchParams({channel:`eq.${config.channel}`,published:'eq.true',select:'envelope'});
    const response=await fetch(url,{headers:{apikey:config.publishableKey},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`Release service returned ${response.status}`);
    const rows=await response.json();if(!rows[0])throw Error('No published releases yet. Installed apps can still open.');
    const next=verifyFeed(rows[0].envelope,config.publicKey,config.channel,version);
    if(Date.parse(next.publishedAt)<highestPublished)throw Error('Release feed is older than the last trusted feed');
    highestPublished=Date.parse(next.publishedAt);feed=next;lastError='';await fs.writeFile(feedCache,JSON.stringify(rows[0].envelope));
    for(const r of feed.releases)if(!jobs.has(r.appId))try{if((await fs.stat(partialFile(r))).size>0)paused.add(r.appId);}catch{}
  }catch(error){lastError=error.message;}
  broadcast();queueMicrotask(checkSelfUpdate);return state();
}
async function running(id){const child=children.get(id);if(child&&child.exitCode===null)return true;const entry=installed[id];if(!entry)return false;try{const {stdout}=await promisify(execFile)('tasklist.exe',['/FI',`IMAGENAME eq ${path.basename(entry.executable)}`,'/FO','CSV','/NH'],{windowsHide:true});return stdout.toLowerCase().includes(`"${path.basename(entry.executable).toLowerCase()}"`);}catch{throw Error('Could not check whether the app is running. Close the app and retry.');}}
async function install(id){
  idCheck(id);if(bulkRemoving)throw Error('Wait for app removal to finish.');if(jobs.has(id))throw Error('This app already has an operation in progress');
  if(process.platform!=='win32'||process.arch!=='x64')throw Error('This release supports Windows x64.');
  const r=feed?.releases.find(r=>r.appId===id);if(!r)throw Error('No trusted release is available. Check for updates first.');
  if(id!=='launcher'&&!semver.gte(version,r.minimumLauncher))throw Error('The launcher is updating. Try this app after it restarts.');
  if(Date.parse(feed.expiresAt)<=Date.now())throw Error('Release information expired. Check for updates again.');
  const old=installed[id];if(old&&!old.broken&&!semver.gt(r.version,old.version))throw Error('The installed version is already current.');
  delete appErrors[id];paused.delete(id);
  const controller=new AbortController();jobs.set(id,controller);const work=path.join(library,`.download-${id}-${crypto.randomUUID()}`);let destination;
  try{
    if(id!=='launcher'&&await running(id))throw Error('Close the app before updating it.');
    await fs.mkdir(work,{recursive:true});const disk=await fs.statfs(work);if(disk.bavail*disk.bsize<r.size+r.unpackedSize+100000000)throw Error('Not enough free disk space.');
    await fs.mkdir(downloadDirectory,{recursive:true});const archive=partialFile(r);controller.phase='download';
    for(let attempt=1;attempt<=3;attempt++)try{await downloadPackage(r,archive,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(1800000)]),progress:data=>{if(!win?.isDestroyed())win?.webContents.send('progress',{id,...data});}});break;}catch(error){if(controller.signal.aborted||attempt===3||/verification|exceeds|Untrusted|outside|range/.test(error.message))throw error;emit(id,`Connection interrupted. Retrying (${attempt+1}/3)`,0);}
    controller.signal.throwIfAborted();controller.phase='install';emit(id,'Verifying',100);
    if(id==='launcher'){await fs.mkdir(updateDirectory,{recursive:true});const file=path.join(updateDirectory,`launcher-${r.version}.exe`);await fs.rename(archive,file);pendingUpdate={file,release:r,phase:'ready'};await fs.writeFile(path.join(updateDirectory,'pending.json'),JSON.stringify({file,release:r}));broadcast();scheduleUpdate();return state();}
    emit(id,'Installing',100);const unpack=path.join(work,'unpacked');
    await extractPackage(archive,unpack,r.unpackedSize,controller.signal);
    controller.signal.throwIfAborted();const exe=safePath(unpack,r.executable);const stat=await fs.lstat(exe);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Package executable is missing');
    destination=safePath(library,`${id}/${r.version}-${crypto.randomUUID()}`);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.rename(unpack,destination);
    installed[id]={version:r.version,directory:path.relative(library,destination).replaceAll('\\','/'),executable:r.executable,installedAt:new Date().toISOString(),...(old&&!old.broken?{previous:{version:old.version,directory:old.directory,executable:old.executable,installedAt:old.installedAt}}:{})};
    try{await saveRegistry();}catch(error){if(old)installed[id]=old;else delete installed[id];await fs.rm(destination,{recursive:true,force:true});throw error;}
    await syncShortcut(id);
    await fs.rm(archive,{force:true});
    // Keep the previous version for manual recovery; never delete app profile data.
    emit(id,'Ready',100);
  }catch(error){if(controller.pauseRequested){paused.add(id);return state();}if(controller.signal.aborted)await fs.rm(partialFile(r),{force:true}).catch(()=>{});else try{if((await fs.stat(partialFile(r))).size>0)paused.add(id);}catch{}await recordError(id,error);throw error;}finally{jobs.delete(id);await fs.rm(work,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});emit(id,'Finished',100);broadcast();scheduleUpdate();}
  return state();
}
async function rollback(id){
  idCheck(id);if(jobs.has(id)||bulkRemoving)throw Error('Wait for the current operation to finish.');
  const current=installed[id],previous=current?.previous;if(!previous)throw Error('No previous installation is available.');
  jobs.set(id,new AbortController());
  try{
    if(await running(id))throw Error('Close the app before restoring its previous version.');
    if(!semver.valid(previous.version)||!previous.directory?.startsWith(id+'/'))throw Error('Invalid recovery installation');
    const dir=safePath(library,previous.directory),exe=safePath(dir,previous.executable),stat=await fs.lstat(exe);
    if(!stat.isFile()||stat.isSymbolicLink())throw Error('Previous installation is missing. Repair the app instead.');
    installed[id]={...previous,previous:{version:current.version,directory:current.directory,executable:current.executable,installedAt:current.installedAt}};
    try{await saveRegistry();}catch(error){installed[id]=current;throw error;}
    delete appErrors[id];await syncShortcut(id);return state();
  }finally{jobs.delete(id);broadcast();}
}
async function pause(id){idCheck(id);const job=jobs.get(id);if(!job||job.phase!=='download')throw Error('Only a download can be paused.');job.pauseRequested=true;job.abort(new Error('Download paused'));return state();}
async function cancel(id){idCheck(id);paused.delete(id);const job=jobs.get(id);if(job){job.pauseRequested=false;job.abort();}else{const r=feed?.releases.find(r=>r.appId===id);if(r)await fs.rm(partialFile(r),{force:true});}return state();}
async function launch(id){idCheck(id);if(jobs.has(id))throw Error('Wait for the update to finish.');const entry=installed[id];if(!entry)throw Error('Install this app first.');const dir=safePath(library,entry.directory);const exe=safePath(dir,entry.executable);const stat=await fs.lstat(exe);if(!stat.isFile()||stat.isSymbolicLink())throw Error('The installed executable is missing.');if(jobs.has(id))throw Error('Wait for the update to finish.');const child=spawn(exe,[],{cwd:dir,detached:true,stdio:'ignore'});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});children.set(id,child);child.once('exit',()=>children.delete(id));child.unref();return state();}
async function uninstall(id,confirmed=false){
  idCheck(id);if(id==='launcher'||jobs.has(id))throw Error('This app cannot be removed during an operation.');if(!installed[id])return state();
  jobs.set(id,new AbortController());
  try{
    if(await running(id))throw Error('Close the app before removing it.');
    const answer=confirmed?{response:0}:await dialog.showMessageBox(win,{type:'question',message:`Uninstall ${productList().find(p=>p.id===id)?.name||id}?`,detail:'Managed app files will be removed. Your app settings and user data are retained.',buttons:['Uninstall app','Cancel'],defaultId:1,cancelId:1});
    if(answer.response!==0)return state();await associations.remove(id,installed[id]);const dir=safePath(library,id),trash=safePath(library,`.removed-${id}-${crypto.randomUUID()}`),previous=installed[id];let moved=false;
    try{await fs.rename(dir,trash);moved=true;}catch(error){if(error.code!=='ENOENT')throw error;}delete installed[id];try{await saveRegistry();}catch(error){installed[id]=previous;if(moved)await fs.rename(trash,dir);throw error;}delete appErrors[id];await shortcuts.remove(id);if(moved)await fs.rm(trash,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
  }catch(error){await recordError(id,error);throw error;}finally{jobs.delete(id);emit(id,'Finished',100);broadcast();}
  return state();
}
async function uninstallAll(){if(jobs.size||bulkRemoving)throw Error('Wait for current app operations to finish.');const ids=Object.keys(installed);if(!ids.length)return state();bulkRemoving=true;broadcast();try{for(const id of ids)if(await running(id))throw Error(`Close ${productList().find(p=>p.id===id)?.name||id} before uninstalling apps.`);const answer=await dialog.showMessageBox(win,{type:'warning',message:`Uninstall all ${ids.length} installed apps?`,detail:'Managed app binaries will be removed. The launcher and your app settings, downloads and documents are retained.',buttons:['Uninstall all apps','Cancel'],defaultId:1,cancelId:1});if(answer.response===0)for(const id of ids)await uninstall(id,true);}finally{bulkRemoving=false;broadcast();scheduleUpdate();}return state();}
if(!app.requestSingleInstanceLock())app.quit();
else app.whenReady().then(async()=>{
  app.setAppUserModelId('com.bluecloud.launcher');await fs.mkdir(library,{recursive:true});
  try{const saved=JSON.parse(await fs.readFile(registryPath,'utf8'));for(const [id,e]of Object.entries(saved)){if(!validAppId(id)||id==='launcher'||!semver.valid(e.version)||!e.directory.startsWith(id+'/'))continue;const dir=safePath(library,e.directory),exe=safePath(dir,e.executable);installed[id]=e;try{if(!(await fs.lstat(exe)).isFile())throw Error();}catch{installed[id].broken=true;appErrors[id]='App files are missing. Choose Repair app to reinstall.';}}}catch(error){if(error.code!=='ENOENT')lastError='The library record could not be read. Contact support before reinstalling apps.';}
  for(const id of Object.keys(installed))await syncShortcut(id);
  try{const envelope=JSON.parse(await fs.readFile(feedCache,'utf8'));feed=verifyFeed(envelope,config.publicKey,config.channel,version);highestPublished=Date.parse(feed.publishedAt);}catch{}
  for(const r of feed?.releases||[])try{if((await fs.stat(partialFile(r))).size>0)paused.add(r.appId);}catch{}
  win=new BrowserWindow({width:1380,height:860,minWidth:920,minHeight:620,titleBarStyle:'hidden',titleBarOverlay:{color:'#14171d',symbolColor:'#9da8b9',height:65},backgroundColor:'#0e1013',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(url.split('#')[0]!==start)event.preventDefault();});win.webContents.on('will-attach-webview',e=>e.preventDefault());
  try{autoUpdate=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'settings.json'),'utf8')).autoUpdate!==false;}catch{}
  try{const saved=JSON.parse(await fs.readFile(path.join(updateDirectory,'pending.json'),'utf8')),r=feed?.releases.find(r=>r.appId==='launcher'&&r.version===saved.release.version&&r.sha256===saved.release.sha256&&semver.gt(r.version,version));if(r){const file=path.join(updateDirectory,`launcher-${r.version}.exe`);await verifyInstaller(file,r);pendingUpdate={file,release:r,phase:'ready'};}}catch{}
  try{
    const result=JSON.parse((await fs.readFile(path.join(updateDirectory,'last-update.json'),'utf8')).replace(/^\uFEFF/,''));
    if(result.success===false&&pendingUpdate?.release.version===result.version){deferUpdate=true;await recordError('launcher',new Error('The last launcher update failed: '+result.error));}
    if(result.success===true&&semver.valid(result.version)&&semver.gte(version,result.version))await fs.rm(path.join(updateDirectory,'pending.json'),{force:true});
  }catch{}
  for(const [name,handler]of Object.entries({state,refresh,install,launch,pause,rollback,uninstall:id=>uninstall(id),uninstallAll,openLink,restartUpdate,deferUpdate:()=>{deferUpdate=true;clearTimeout(updateTimer);updateTimer=null;return state();},setAutoUpdate:async enabled=>{if(typeof enabled!=='boolean')throw Error('Invalid setting');autoUpdate=enabled;await fs.writeFile(path.join(app.getPath('userData'),'settings.json'),JSON.stringify({autoUpdate}));if(enabled){deferUpdate=false;checkSelfUpdate();scheduleUpdate();}return state();},cancel}))ipcMain.handle(name,async(event,...args)=>{sender(event);try{return{ok:true,state:await handler(...args)};}catch(error){return{ok:false,error:error.message};}});
  win.loadURL(start);app.on('second-instance',()=>{if(win.isMinimized())win.restore();win.focus();});
  if(app.isPackaged){win.webContents.once('did-finish-load',()=>refresh());setInterval(()=>refresh(),10*60*1000).unref();}
  win.on('close',event=>{if(app.isQuitting)return;if(jobs.size){event.preventDefault();dialog.showMessageBox(win,{message:'An app operation is in progress',detail:'Cancel the download or wait for installation to finish before closing.'});}else if(pendingUpdate?.phase==='ready'&&autoUpdate&&!deferUpdate){event.preventDefault();restartUpdate().catch(()=>{});}});
});
app.on('before-quit',()=>{app.isQuitting=true;});
app.on('window-all-closed',()=>app.quit());
