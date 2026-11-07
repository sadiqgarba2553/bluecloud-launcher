// Linux uses the distribution's signed packages, not the Windows release feed.
const {app,BrowserWindow,ipcMain,Menu,shell}=require('electron');
const path=require('node:path');
const {execFile,spawn}=require('node:child_process');
const {promisify}=require('node:util');
const {pathToFileURL}=require('node:url');
app.setDesktopName('com.bluecloud.launcher.desktop');
const run=promisify(execFile);
const ids=['doc-cloud','sheet-cloud','slide-cloud','tooldeck'];
const packages={'doc-cloud':'bluecloud-doc-cloud','sheet-cloud':'bluecloud-sheet-cloud','slide-cloud':'bluecloud-slide-cloud',tooldeck:'bluecloud-tooldeck'};
const products=require('../products.json').filter(product=>ids.includes(product.id)).map(product=>({...product,platform:'Linux x86_64',note:'Included with BlueCloud Linux. Updates are managed by System Settings.'}));
const start=pathToFileURL(path.join(__dirname,'../ui/index.html')).href;
let win;
const errors={};
async function state(){
  const installed={};
  for(const id of ids){
    try{
      const {stdout}=await run('/usr/bin/pacman',['-Q',packages[id]],{timeout:10000});
      const [name,version]=stdout.trim().split(/\s+/);
      if(name===packages[id]&&version)installed[id]={version,systemManaged:true};
    }catch(error){if(error.code!==1)errors[id]='Could not read the system package database.';}
  }
  return {products,installed,releases:[],version:require('../package.json').version,channel:'system',systemManaged:true,error:'',appErrors:{...errors},busy:[],paused:[],bulkRemoving:false,autoUpdate:false,selfUpdate:null};
}
function idCheck(id){if(!ids.includes(id))throw Error('Unknown Linux app.');}
async function launch(command,args=[]){
  const child=spawn(command,args,{detached:true,stdio:'ignore'});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  child.unref();
}
if(!app.requestSingleInstanceLock())app.quit();
else app.whenReady().then(()=>{
  win=new BrowserWindow({width:1260,height:820,minWidth:920,minHeight:620,title:'BlueCloud Launcher',backgroundColor:'#f7f9fc',icon:path.join(__dirname,'../assets/launcher.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url.split('#')[0]!==start)event.preventDefault();});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  const handlers={
    state,
    refresh:state,
    systemUpdates:async()=>{await launch('/usr/bin/bluecloud-shell',['--settings-window','--settings-page','updates']);return state();},
    launch:async id=>{idCheck(id);if(!(await state()).installed[id])throw Error('This system app is not installed. Open System Settings to repair the installation.');try{await launch('/usr/bin/'+id);delete errors[id];}catch(error){errors[id]=error.message;throw error;}return state();},
    openLink:async input=>{if(input?.id!=='launcher')idCheck(input?.id);const repository=input.id==='launcher'?'bluecloud-launcher':input.id;const urls={website:'https://bluecloudai.online/',source:'https://github.com/sadiqgarba2553/'+repository,support:'https://github.com/sadiqgarba2553/'+repository+'/issues'};if(!Object.hasOwn(urls,input.kind))throw Error('Unknown link.');await shell.openExternal(urls[input.kind]);return state();}
  };
  for(const name of ['state','refresh','systemUpdates','launch','openLink','install','uninstall','uninstallAll','pause','cancel','rollback','restartUpdate','deferUpdate','setAutoUpdate']){
    ipcMain.handle(name,async(event,...args)=>{
      if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url.split('#')[0]!==start)throw Error('Untrusted window.');
      try{if(!handlers[name])throw Error('Manage Linux packages through System Settings.');return {ok:true,state:await handlers[name](...args)};}catch(error){return {ok:false,error:error.message};}
    });
  }
  win.loadURL(start);
  app.on('second-instance',()=>{if(win.isMinimized())win.restore();win.show();win.focus();});
});
app.on('window-all-closed',()=>app.quit());
