const yauzl=require('yauzl');
// Electron treats .asar paths as virtual directories. Managed app archives
// contain other apps' .asar files, which must be written as ordinary bytes.
const disk=process.versions.electron?require('original-fs'):require('node:fs');
const fs=disk.promises;
const {createWriteStream}=disk;
const path=require('node:path');
const {pipeline}=require('node:stream/promises');
const {Transform}=require('node:stream');
const {safePath}=require('./security.cjs');
async function extractPackage(archive,directory,limit,signal){
  await fs.mkdir(directory,{recursive:true});
  return new Promise((resolve,reject)=>{
    yauzl.open(archive,{lazyEntries:true,strictFileNames:true,validateEntrySizes:true},(error,zip)=>{
      if(error)return reject(error);let total=0,count=0,failed=false;
      const fail=error=>{if(failed)return;failed=true;zip.close();reject(error);};
      zip.on('error',fail);zip.on('end',()=>{if(!failed)resolve();});
      zip.on('entry',entry=>{
        (async()=>{
          signal?.throwIfAborted();if(++count>100000)throw Error('Too many files in package');
          const name=entry.fileName.replace(/\/$/,'');const target=safePath(directory,name);
          const mode=(entry.externalFileAttributes>>>16)&0o170000;
          if(mode&&mode!==0o100000&&mode!==0o040000)throw Error('Package contains a link or special file');
          total+=entry.uncompressedSize;if(total>limit)throw Error('Expanded package exceeds its limit');
          if(entry.fileName.endsWith('/')){await fs.mkdir(target,{recursive:true});return;}
          await fs.mkdir(path.dirname(target),{recursive:true});
          const stream=await new Promise((res,rej)=>zip.openReadStream(entry,(err,s)=>err?rej(err):res(s)));
          let actual=0;const guard=new Transform({transform(chunk,_encoding,callback){actual+=chunk.length;if(actual>entry.uncompressedSize)callback(Error('Invalid expanded file size'));else callback(null,chunk);}});
          await pipeline(stream,guard,createWriteStream(target,{flags:'wx'}),{signal});
          if(actual!==entry.uncompressedSize)throw Error('Truncated archive entry');
        })().then(()=>{if(!failed)zip.readEntry();},fail);
      });
      zip.readEntry();
    });
  });
}
module.exports={extractPackage};
