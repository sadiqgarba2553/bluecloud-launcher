const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const {createHash}=require('node:crypto');
const {trustedDownload}=require('./security.cjs');

async function downloadPackage(release,dest,{signal,progress=()=>{},fetch:request=global.fetch}={}){
  let bytes=0;
  try{bytes=(await fs.stat(dest)).size;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(bytes>release.size){await fs.rm(dest,{force:true});bytes=0;}
  const hash=createHash('sha256');
  if(bytes)for await(const chunk of createReadStream(dest)){signal?.throwIfAborted();hash.update(chunk);}
  if(bytes===release.size){if(hash.digest('hex')===release.sha256)return;await fs.rm(dest,{force:true});throw Error('Package verification failed. Retry the download.');}
  let url=trustedDownload(release.url,release.appId),response;
  for(let hop=0;hop<6;hop++){
    signal?.throwIfAborted();
    response=await request(url,{signal,redirect:'manual',headers:bytes?{Range:`bytes=${bytes}-`}:{}});
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');await response.body?.cancel();
      if(!location)throw Error('Missing download redirect');
      url=trustedDownload(new URL(location,url).href,release.appId);response=null;continue;
    }
    break;
  }
  if(!response?.ok||!response.body)throw Error(`Download failed (${response?.status||'too many redirects'})`);
  if(response.status===206){
    const range=response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    if(!range||Number(range[1])!==bytes||Number(range[2])!==release.size-1||Number(range[3])!==release.size){await response.body.cancel();throw Error('Invalid download range');}
  }else if(response.status===200){bytes=0;}
  else{await response.body.cancel();throw Error('Unexpected download response');}
  // Servers may ignore Range. Start over without combining different responses.
  const digest=bytes?hash:createHash('sha256'),file=await fs.open(dest,bytes?'a':'w');
  const started=Date.now(),initial=bytes;let last=0;
  const report=()=>{const speed=(bytes-initial)/Math.max(.001,(Date.now()-started)/1000);progress({phase:'Downloading',percent:Math.floor(bytes/release.size*100),bytes,totalBytes:release.size,speed,eta:speed>0?Math.ceil((release.size-bytes)/speed):null});};
  try{
    report();
    for await(const chunk of response.body){
      signal?.throwIfAborted();
      if(bytes+chunk.length>release.size)throw Error('Package exceeds the expected size');
      let offset=0;while(offset<chunk.length){const written=await file.write(chunk,offset,chunk.length-offset);if(!written.bytesWritten)throw Error('Could not write the downloaded package');offset+=written.bytesWritten;}
      digest.update(chunk);bytes+=chunk.length;
      if(Date.now()-last>200||bytes===release.size){report();last=Date.now();}
    }
  }catch(error){
    await file.close();
    if(/exceeds/.test(error.message))await fs.rm(dest,{force:true});
    throw error;
  }
  await file.close();signal?.throwIfAborted();
  if(bytes!==release.size)throw Error('Connection interrupted before the download finished');
  if(digest.digest('hex')!==release.sha256){await fs.rm(dest,{force:true});throw Error('Package verification failed. Retry the download.');}
}
module.exports={downloadPackage};
