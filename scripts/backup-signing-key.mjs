import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createPublicKey} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const appDir=fileURLToPath(new URL('../',import.meta.url)),root=path.resolve(appDir,'../..');
const config=JSON.parse(await readFile(path.join(appDir,'config.json'),'utf8'));
const destination=process.env.BLUECLOUD_SIGNING_KEY||path.join(process.env.LOCALAPPDATA||os.homedir(),'BlueCloud','ReleaseSigning','release-private.pem');
let key;try{key=await readFile(destination,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;key=await readFile(path.join(root,'artifacts/signing/release-private.pem'),'utf8');}
if(createPublicKey(key).export({type:'spki',format:'pem'})!==config.publicKey)throw Error('Signing key does not match the launcher trust configuration');
await mkdir(path.dirname(destination),{recursive:true});
try{await writeFile(destination,key,{flag:'wx',mode:0o600});console.log('Private release-signing key backed up outside build artifacts; public key matches the launcher.');}catch(error){if(error.code!=='EEXIST')throw error;console.log('Existing private signing-key backup verified.');}
