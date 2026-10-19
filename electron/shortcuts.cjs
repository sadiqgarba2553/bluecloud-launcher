const path=require('node:path');
const {safePath,validAppId}=require('./security.cjs');
// Each app owns a folder, so names from future catalogs never become paths.
function createShortcuts({fs,shell,root,library}){
  const names={tooldeck:'Tool Deck',quranly:'Quranly PC',coneic:'Coneic Player'};
  async function remove(id){if(!validAppId(id))throw Error('Invalid app');await fs.rm(safePath(root,id),{recursive:true,force:true});}
  async function sync(id,entry,product){
    if(!validAppId(id))throw Error('Invalid app');
    if(entry.broken)return remove(id);
    const directory=safePath(library,entry.directory),target=safePath(directory,entry.executable);
    const folder=safePath(root,id);await fs.mkdir(folder,{recursive:true});
    const name=names[id]||id;
    const link=path.join(folder,`${name}.lnk`);
    if(!shell.writeShortcutLink(link,'create',{target,cwd:directory,icon:target,iconIndex:0,description:`${product?.name||name} — installed with BlueCloud Launcher`,appUserModelId:`com.bluecloud.apps.${id}`}))throw Error('Windows could not create the app shortcut');
  }
  return{sync,remove};
}
module.exports={createShortcuts};
