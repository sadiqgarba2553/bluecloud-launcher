const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {safePath}=require('./security.cjs');

function createAssociations({fs,library,enabled=process.platform==='win32',execute=promisify(execFile)}){
  async function apply(action,id,entry){
    if(!enabled||id!=='coneic')return;
    const directory=safePath(library,entry.directory);
    const script=safePath(directory,'Coneic-shell/register-file-associations.ps1');
    try{const info=await fs.lstat(script);if(!info.isFile()||info.isSymbolicLink())throw Error('Invalid Coneic registration helper');}
    catch(error){if(error.code==='ENOENT')return;throw error;} // Older payloads have no helper.
    const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    await execute(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-AppDirectory',directory,'-Action',action],{windowsHide:true,timeout:60000});
  }
  return{sync:(id,entry)=>entry.broken?apply('Unregister',id,entry):apply('Register',id,entry),remove:(id,entry)=>apply('Unregister',id,entry)};
}
module.exports={createAssociations};
