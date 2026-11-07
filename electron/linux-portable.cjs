const {app,BrowserWindow,ipcMain,Menu,shell}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const semver=require('semver'),{verifyFeed}=require('./security.cjs'),{LinuxLibrary}=require('./linux-library.cjs');
const linux=require('../linux-config.json');
const config=require('../config.json'),version=require('../package.json').version;
const ids=['doc-cloud','sheet-cloud','slide-cloud','canvas-cloud','tooldeck','launcher'];
const products=require('../products.json').filter(p=>ids.includes(p.id)).map(p=>({...p,platform:'Linux x86_64'}));
const start=pathToFileURL(path.join(__dirname,'../ui/index.html')).href;
let win,library,feed,error='',highestPublished=0,autoUpdate=true,timer;
const paused=new Set();
const errors={},settingsFile=()=>path.join(app.getPath('userData'),'linux-settings.json'),cacheFile=()=>path.join(app.getPath('userData'),'linux-feed.json');
function state(){return {products,installed:library.installed,releases:(feed?.releases||[]).filter(r=>ids.includes(r.appId)).map(r=>({...r,requiresLauncher:semver.gt(r.minimumLauncher,version),updateAvailable:semver.gt(r.version,r.appId==='launcher'?version:library.installed[r.appId]?.version||r.version)})),version,platform:'linux',channel:'linux-alpha',error,appErrors:{...errors},busy:[...library.jobs.keys()],paused:[...paused],bulkRemoving:false,autoUpdate,selfUpdate:library.installed.launcher&&semver.gt(library.installed.launcher.version,version)?{version:library.installed.launcher.version,phase:'ready',deferred:true}:null};}
function broadcast(){if(win&&!win.isDestroyed())win.webContents.send('state-changed',state());}
async function refresh(){try{
 const response=await fetch(linux.feedURL,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)throw Error(`Linux release service returned ${response.status}`);
 const raw=await response.text();if(raw.length>1500000)throw Error('Release feed is too large');const envelope=JSON.parse(raw),next=verifyFeed(envelope,linux.publicKey,'linux-alpha',version,Date.now(),'linux');if(Date.parse(next.publishedAt)<highestPublished)throw Error('Release feed is older than the last trusted feed');
 await fs.writeFile(cacheFile(),raw,{mode:0o600});feed=next;highestPublished=Date.parse(next.publishedAt);error='';
 }catch(e){error=e.message;}broadcast();return state();}
function idCheck(id){if(!ids.includes(id))throw Error('Unknown Linux app');}
async function shortcut(id,remove=false){
 idCheck(id);const root=path.join(process.env.XDG_DATA_HOME||path.join(os.homedir(),'.local/share'),'applications'),file=path.join(root,`com.bluecloud.${id}.desktop`);
 if(remove){await fs.rm(file,{force:true});return;}
 const product=products.find(p=>p.id===id),exe=library.executable(id);if(/[\r\n]/.test(exe))throw Error('Unsupported desktop entry path');
 const quote=value=>'"'+value.replace(/[\\"`$]/g,'\\$&').replaceAll('%','%%')+'"';
 await fs.mkdir(root,{recursive:true});await fs.writeFile(file,`[Desktop Entry]\nType=Application\nName=${product.name}\nExec=${quote(exe)} --appimage-extract-and-run\nTerminal=false\nCategories=Office;\n`,{mode:0o644});
}
async function install(id){idCheck(id);const r=feed?.releases.find(r=>r.appId===id);if(!r||Date.parse(feed.expiresAt)<=Date.now())throw Error('No current verified Linux release available');paused.delete(id);if(semver.gt(r.minimumLauncher,version))throw Error('Update the launcher first');try{await library.install(r);if(id!=='launcher')await shortcut(id);delete errors[id];}catch(e){errors[id]=e.message;throw e;}finally{broadcast();}return state();}
async function launch(id){idCheck(id);const file=library.executable(id);await fs.access(file);const child=spawn(file,['--appimage-extract-and-run'],{detached:true,stdio:'ignore',env:{...process.env,APPIMAGE_EXTRACT_AND_RUN:'1'}});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();return state();}
let checking=false;
async function check(){if(checking)return;checking=true;try{await refresh();if(autoUpdate)for(const r of state().releases)if(r.updateAvailable&&!r.requiresLauncher&&!library.jobs.size)try{await install(r.appId);}catch{}}finally{checking=false;}}
if(!app.requestSingleInstanceLock())app.quit();else app.whenReady().then(async()=>{
 library=await new LinuxLibrary(path.join(app.getPath('userData'),'linux-library'),{progress:(id,p)=>win?.webContents.send('progress',{id,...p})}).load();
 try{autoUpdate=JSON.parse(await fs.readFile(settingsFile(),'utf8')).autoUpdate!==false;}catch(e){if(e.code!=='ENOENT')error='Could not read update preferences';}
 try{feed=verifyFeed(JSON.parse(await fs.readFile(cacheFile(),'utf8')),linux.publicKey,'linux-alpha',version,Date.now(),'linux');highestPublished=Date.parse(feed.publishedAt);}catch{}
 win=new BrowserWindow({width:1260,height:820,minWidth:920,minHeight:620,title:'BlueCloud Launcher',backgroundColor:'#f7f9fc',icon:path.join(__dirname,'../assets/launcher.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 Menu.setApplicationMenu(null);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(url.split('#')[0]!==start)event.preventDefault();});win.webContents.on('will-attach-webview',event=>event.preventDefault());
 const handlers={state,refresh,install,launch,uninstall:async id=>{idCheck(id);await library.uninstall(id);await shortcut(id,true);return state();},rollback:async id=>{idCheck(id);await library.rollback(id);await shortcut(id);return state();},cancel:async id=>{idCheck(id);paused.delete(id);library.cancel(id);return state();},pause:async id=>{idCheck(id);paused.add(id);library.cancel(id);return state();},uninstallAll:async()=>{for(const id of Object.keys(library.installed)){idCheck(id);if(id!=='launcher'){await library.uninstall(id);await shortcut(id,true);}}return state();},setAutoUpdate:async value=>{autoUpdate=Boolean(value);await fs.writeFile(settingsFile(),JSON.stringify({autoUpdate}),{mode:0o600});return state();},restartUpdate:async()=>{const file=library.executable('launcher');await fs.access(file);await shortcut('launcher');const child=spawn('/bin/sh',['-c','while kill -0 "$1" 2>/dev/null; do sleep 1; done; exec "$2" --appimage-extract-and-run','bluecloud-restart',String(process.pid),file],{detached:true,stdio:'ignore'});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();app.quit();return state();},deferUpdate:state,openLink:async input=>{idCheck(input?.id);const repo=config.repositories[input.id],links={website:'https://bluecloudai.online/',source:`https://github.com/${repo}`,support:`https://github.com/${repo}/issues`};if(!Object.hasOwn(links,input.kind))throw Error('Unknown link');await shell.openExternal(links[input.kind]);return state();}};
 for(const [name,handler]of Object.entries(handlers))ipcMain.handle(name,async(event,...args)=>{if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url.split('#')[0]!==start)throw Error('Untrusted window');try{return {ok:true,state:await handler(...args)};}catch(e){return {ok:false,error:e.message};}});
 await win.loadURL(start);check();timer=setInterval(check,15*60*1000);app.on('second-instance',()=>{if(win.isMinimized())win.restore();win.show();win.focus();});
}).catch(e=>{console.error(e);app.quit();});
app.on('window-all-closed',()=>{clearInterval(timer);app.quit();});
