const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto');
const {downloadPackage}=require('../electron/download.cjs');
const bytes=Buffer.from('a complete signed app archive'),release={appId:'tooldeck',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),url:'https://github.com/sadiqgarba2553/tooldeck/releases/download/test/app.zip'};
async function fixture(run){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'download-resume-'));try{await run(path.join(dir,'app.part'));}finally{await fs.rm(dir,{recursive:true,force:true});}}
test('resumes a partial package with a checked byte range and verifies the entire archive',()=>fixture(async file=>{
  await fs.writeFile(file,bytes.subarray(0,9));let progress;
  await downloadPackage(release,file,{fetch:async(url,options)=>{assert.equal(options.headers.Range,'bytes=9-');return new Response(bytes.subarray(9),{status:206,headers:{'content-range':`bytes 9-${bytes.length-1}/${bytes.length}`}});},progress:value=>progress=value});
  assert.deepEqual(await fs.readFile(file),bytes);assert.equal(progress.percent,100);assert.equal(progress.bytes,bytes.length);
}));
test('a server ignoring Range restarts cleanly and an invalid range is rejected',()=>fixture(async file=>{
  await fs.writeFile(file,bytes.subarray(0,5));await downloadPackage(release,file,{fetch:async()=>new Response(bytes)});assert.deepEqual(await fs.readFile(file),bytes);
  await fs.writeFile(file,bytes.subarray(0,5));await assert.rejects(()=>downloadPackage(release,file,{fetch:async()=>new Response(bytes.subarray(5),{status:206,headers:{'content-range':`bytes 0-${bytes.length-1}/${bytes.length}`}})}),/Invalid download range/);
}));
test('a paused stream retains received bytes for a later resume',()=>fixture(async file=>{
  const controller=new AbortController();let pulls=0;
  const body=new ReadableStream({pull(stream){if(pulls++===0)stream.enqueue(bytes.subarray(0,8));else{controller.abort(new Error('Paused'));stream.error(controller.signal.reason);}}});
  await assert.rejects(()=>downloadPackage(release,file,{signal:controller.signal,fetch:async()=>new Response(body)}),/Paused/);
  assert.ok((await fs.stat(file)).size<bytes.length);
}));
test('tampered cached bytes fail verification and are discarded',()=>fixture(async file=>{
  await fs.writeFile(file,Buffer.alloc(6,0));await assert.rejects(()=>downloadPackage(release,file,{fetch:async()=>new Response(bytes.subarray(6),{status:206,headers:{'content-range':`bytes 6-${bytes.length-1}/${bytes.length}`}})}),/verification failed/);
  await assert.rejects(()=>fs.stat(file),{code:'ENOENT'});
}));
