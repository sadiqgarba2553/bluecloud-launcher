const {test}=require('node:test');const assert=require('node:assert/strict');const {generateKeyPairSync,sign}=require('node:crypto');
test('download tickets authenticate the app and expiry before any upstream request',async()=>{
  const {handle}=await import('../supabase/functions/app-release-download/index.mjs');
  const pair=generateKeyPairSync('ed25519'),key=await crypto.subtle.importKey('spki',pair.publicKey.export({type:'spki',format:'der'}),{name:'Ed25519'},false,['verify']);
  const make=(claims={})=>{const bytes=Buffer.from(JSON.stringify({purpose:'bluecloud-app-download-v1',appId:'quranly',version:'0.5.0',expiresAt:new Date(Date.now()+60000).toISOString(),...claims}));return 'https://example.test/?ticket='+bytes.toString('base64url')+'&signature='+sign(null,bytes,pair.privateKey).toString('base64url');};
  let calls=0;const options={publicKey:key,fetch:async(url,settings)=>{calls++;assert.equal(url,'https://github.com/sadiqgarba2553/quranly-pc/releases/download/v0.5.0/quranly-0.5.0-win-x64.zip');assert.equal(settings.method,'HEAD');return{ok:true,url:'https://release-assets.githubusercontent.com/verified-file',body:null};}};
  const good=await handle(new Request(make()),options);assert.equal(good.status,302);assert.equal(good.headers.get('Location'),'https://release-assets.githubusercontent.com/verified-file');assert.equal(calls,1);
  for(const url of ['https://example.test/',make({expiresAt:'2020-01-01'}),make({appId:'constructor'}),make({purpose:'other'}),make().replace('ticket=','ticket=tampered')])assert.equal((await handle(new Request(url),options)).status,401);
  assert.equal(calls,1);
  assert.equal((await handle(new Request(make(),{method:'POST'}),options)).status,405);
  const unsafe=await handle(new Request(make()),{...options,fetch:async()=>({ok:true,url:'https://evil.example/file'})});assert.equal(unsafe.status,502);
});
