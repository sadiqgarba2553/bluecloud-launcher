const fs=require('node:fs/promises');
const path=require('node:path');
const {downloadPackage}=require('./download.cjs');
const {validAppId}=require('./security.cjs');
class LinuxLibrary {
 constructor(root,{download=downloadPackage,progress=()=>{}}={}){Object.assign(this,{root,download,progress,installed:{},jobs:new Map()});}
 async load(){await fs.mkdir(this.root,{recursive:true,mode:0o700});try{this.installed=JSON.parse(await fs.readFile(path.join(this.root,'installed-linux.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
 directory(id){if(!validAppId(id))throw Error('Invalid app ID');return path.join(this.root,id);}
 executable(id,entry=this.installed[id]){if(!entry||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('App is not installed');return path.join(this.directory(id),entry.sha256,'app.AppImage');}
 async save(next){const file=path.join(this.root,'installed-linux.json');await fs.writeFile(file+'.tmp',JSON.stringify(next,null,2),{mode:0o600});await fs.rename(file+'.tmp',file);this.installed=next;}
 async install(r){
  if(this.jobs.size)throw Error('Wait for the current app operation to finish');
  this.directory(r.appId);if(!/^[a-f0-9]{64}$/.test(r.sha256))throw Error('Invalid package digest');const abort=new AbortController();this.jobs.set(r.appId,abort);
  try{const dir=path.join(this.directory(r.appId),r.sha256);await fs.mkdir(dir,{recursive:true,mode:0o700});const file=path.join(dir,'app.AppImage');
   await this.download(r,file+'.part',{signal:abort.signal,progress:p=>this.progress(r.appId,p)});abort.signal.throwIfAborted();await fs.chmod(file+'.part',0o700);await fs.rename(file+'.part',file);
   const old=this.installed[r.appId];await this.save({...this.installed,[r.appId]:{version:r.version,sha256:r.sha256,...(old&&old.sha256!==r.sha256?{previous:{version:old.version,sha256:old.sha256}}:old?.previous?{previous:old.previous}:{})}});
  }finally{this.jobs.delete(r.appId);}
 }
 cancel(id){this.jobs.get(id)?.abort();}
 async rollback(id){if(this.jobs.size)throw Error('Wait for the current app operation');const old=this.installed[id];if(!old?.previous)throw Error('No previous version');await fs.access(this.executable(id,old.previous));await this.save({...this.installed,[id]:{...old.previous,previous:{version:old.version,sha256:old.sha256}}});}
 async uninstall(id){if(this.jobs.size)throw Error('Wait for the current app operation');this.directory(id);const next={...this.installed};delete next[id];await this.save(next);await fs.rm(this.directory(id),{recursive:true,force:true});}
}
module.exports={LinuxLibrary};
