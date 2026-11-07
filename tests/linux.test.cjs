const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {LinuxLibrary}=require('../electron/linux-library.cjs'),{verifyFeed}=require('../electron/security.cjs');
test('Linux feed requires a valid signature, Linux channel and Linux packages',()=>{
 const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519'),now=Date.now();
 const release={appId:'doc-cloud',version:'1.1.0',minimumLauncher:'0.8.0',platform:'linux',arch:'x64',packageType:'appimage',size:10,unpackedSize:10,sha256:'a'.repeat(64),url:'https://github.com/sadiqgarba2553/doc-cloud/releases/download/linux-v1.1.0/Doc.AppImage'};
 const envelope=(r=release)=>{const payload=JSON.stringify({schemaVersion:1,channel:'linux-alpha',publishedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString(),releases:[r]});return {payload,signature:crypto.sign(null,Buffer.from(payload),privateKey).toString('base64')};};
 assert.equal(verifyFeed(envelope(),publicKey,'linux-alpha','0.8.0',now,'linux').releases.length,1);
 assert.throws(()=>verifyFeed(envelope(),publicKey,'alpha','0.8.0',now,'linux'));
 assert.throws(()=>verifyFeed(envelope({...release,platform:'win32'}),publicKey,'linux-alpha','0.8.0',now,'linux'));
 assert.throws(()=>verifyFeed(envelope({...release,packageType:'zip'}),publicKey,'linux-alpha','0.8.0',now,'linux'));
 const changed=envelope();changed.payload+=' ';assert.throws(()=>verifyFeed(changed,publicKey,'linux-alpha','0.8.0',now,'linux'));
});
test('Linux activation survives failed updates and preserves rollback across restarts',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'bluecloud-linux-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 let fail=false;const download=async(r,file)=>{if(fail)throw Error('integrity failure');await fs.writeFile(file,'app');};
 let lib=await new LinuxLibrary(root,{download}).load();const r={appId:'doc-cloud',version:'1.1.0',sha256:'a'.repeat(64)};
 await lib.install(r);assert.equal((await fs.stat(lib.executable(r.appId))).mode&0o777,0o700);
 fail=true;await assert.rejects(lib.install({...r,version:'1.2.0',sha256:'b'.repeat(64)}));assert.equal(lib.installed[r.appId].version,'1.1.0');
 fail=false;await lib.install({...r,version:'1.2.0',sha256:'b'.repeat(64)});lib=await new LinuxLibrary(root,{download}).load();await lib.rollback(r.appId);assert.equal(lib.installed[r.appId].version,'1.1.0');
 await lib.uninstall(r.appId);assert.equal(lib.installed[r.appId],undefined);assert.throws(()=>lib.directory('../escape'));
});
