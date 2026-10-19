const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createAssociations}=require('../electron/associations.cjs');
test('Coneic registration follows install, repair and removal; isolated profiles stay isolated',async()=>{
  const library=await fs.mkdtemp(path.join(os.tmpdir(),'coneic-associations-'));
  try{
    const entry={directory:'coneic/version with spaces',executable:'Coneic.exe'},calls=[];
    const directory=path.join(library,entry.directory);
    await fs.mkdir(path.join(directory,'Coneic-shell'),{recursive:true});
    const execute=async(exe,args,options)=>calls.push({exe,args,options});
    const api=createAssociations({fs,library,enabled:true,execute});
    await api.sync('coneic',entry);assert.equal(calls.length,0); // old packages
    await fs.writeFile(path.join(directory,'Coneic-shell/register-file-associations.ps1'),'fixture');
    await api.sync('coneic',entry);await api.remove('coneic',entry);
    assert.deepEqual(calls.map(c=>c.args.at(-1)),['Register','Unregister']);
    assert.equal(calls[0].args[calls[0].args.indexOf('-AppDirectory')+1],directory);
    assert.equal(calls[0].options.windowsHide,true);
    await api.sync('quranly',entry);
    await createAssociations({fs,library,enabled:false,execute}).sync('coneic',entry);
    assert.equal(calls.length,2);
    await assert.rejects(()=>api.sync('coneic',{directory:'../escape'}),/path/i);
  }finally{await fs.rm(library,{recursive:true,force:true});}
});
