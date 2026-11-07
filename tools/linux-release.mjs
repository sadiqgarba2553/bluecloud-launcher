import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,sign,createPrivateKey,createPublicKey} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(path.join(root,'config.json'))),linux=JSON.parse(await readFile(path.join(root,'linux-config.json')));
const [mode,...args]=process.argv.slice(2);
async function digest(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
if(mode==='metadata'){
 const [id,directory,version,output]=args,repo=config.repositories[id];
 if(!repo||!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version))throw Error('Expected known app ID, asset directory, version and output file');
 const files=(await readdir(directory)).filter(f=>f.endsWith('.AppImage'));if(files.length!==1)throw Error('Expected exactly one AppImage');const file=path.join(directory,files[0]),size=(await stat(file)).size;
 const record={appId:id,version,minimumLauncher:'0.8.0',platform:'linux',arch:'x64',packageType:'appimage',size,unpackedSize:size,sha256:await digest(file),url:`https://github.com/${repo}/releases/download/linux-v${version}/${encodeURIComponent(files[0])}`,repository:repo,notes:'Linux x86_64 alpha. Local data is preserved during launcher-managed updates.'};
 await writeFile(output,JSON.stringify(record,null,2)+'\n');console.log('Prepared Linux metadata for '+id);
}else if(mode==='feed'){
 const [planFile,output]=args;if(!process.env.BLUECLOUD_LINUX_SIGNING_KEY)throw Error('Set BLUECLOUD_LINUX_SIGNING_KEY to the local Linux release key');
 const key=createPrivateKey(await readFile(process.env.BLUECLOUD_LINUX_SIGNING_KEY));if(createPublicKey(key).export({type:'spki',format:'pem'})!==linux.publicKey)throw Error('Signing key does not match launcher trust key');
 const plan=JSON.parse(await readFile(planFile)),releases=[];
 for(const [id,version]of Object.entries(plan)){
  const repo=config.repositories[id];if(!repo||!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version))throw Error('Invalid Linux release plan');
  const res=await fetch(`https://github.com/${repo}/releases/download/linux-v${version}/app-release-linux.json`);if(!res.ok)throw Error(`Linux metadata unavailable: ${id} (${res.status})`);const r=await res.json();
  if(r.appId!==id||r.version!==version||r.repository!==repo)throw Error('Linux metadata identity mismatch');require('../electron/security.cjs').trustedDownload(r.url,id);
  const asset=await fetch(r.url);if(!asset.ok||!asset.body)throw Error('Public Linux download unavailable: '+id);const hash=createHash('sha256');let size=0;for await(const chunk of asset.body){hash.update(chunk);size+=chunk.length;}if(size!==r.size||hash.digest('hex')!==r.sha256)throw Error('Public Linux download integrity failure: '+id);releases.push(r);
 }
 const now=new Date(),expires=new Date(now.getTime()+365*86400000),payload=JSON.stringify({schemaVersion:1,channel:'linux-alpha',publishedAt:now.toISOString(),expiresAt:expires.toISOString(),releases});
 const envelope={payload,signature:sign(null,Buffer.from(payload),key).toString('base64')};require('../electron/security.cjs').verifyFeed(envelope,linux.publicKey,'linux-alpha',require('../package.json').version,Date.now(),'linux');
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(envelope,null,2)+'\n');console.log('Signed Linux feed; public downloads verified');
}else throw Error('Use metadata <app-id> <asset-dir> <version> <output>, or feed <plan.json> <output>');
