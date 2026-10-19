const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bluecloud', {
  state:()=>ipcRenderer.invoke('state'), refresh:()=>ipcRenderer.invoke('refresh'),
  install:id=>ipcRenderer.invoke('install',id), launch:id=>ipcRenderer.invoke('launch',id),
  pause:id=>ipcRenderer.invoke('pause',id),rollback:id=>ipcRenderer.invoke('rollback',id),
  cancel:id=>ipcRenderer.invoke('cancel',id), uninstall:id=>ipcRenderer.invoke('uninstall',id),
  uninstallAll:()=>ipcRenderer.invoke('uninstallAll'),restartUpdate:()=>ipcRenderer.invoke('restartUpdate'),deferUpdate:()=>ipcRenderer.invoke('deferUpdate'),setAutoUpdate:enabled=>ipcRenderer.invoke('setAutoUpdate',enabled),
  openLink:input=>ipcRenderer.invoke('openLink',input),
  onProgress:callback=>{const handler=(_event,data)=>callback(data);ipcRenderer.on('progress',handler);return()=>ipcRenderer.removeListener('progress',handler);},
  onState:callback=>{const handler=(_event,data)=>callback(data);ipcRenderer.on('state-changed',handler);return()=>ipcRenderer.removeListener('state-changed',handler);},
});
