// Build a signed feed locally. Private release keys are never sent to Actions.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {sign} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(path.join(root,'config.json'),'utf8'));
const key=await readFile(process.env.BLUECLOUD_SIGNING_KEY||path.join(process.env.LOCALAPPDATA,'BlueCloud/ReleaseSigning/release-private.pem'),'utf8');
const plan=JSON.parse(await readFile(process.argv[2],'utf8'));
const output=path.resolve(process.argv[3]||path.join(root,'.release/feed'));await mkdir(output,{recursive:true});
const published=new Date(),expires=new Date(published);expires.setUTCFullYear(expires.getUTCFullYear()+1);
const releases=[];
for(const [appId,repository] of Object.entries(config.repositories)){
  const version=plan[appId];if(!version)throw Error('Missing planned app version');
  const endpoint=`https://github.com/${repository}/releases/download/v${version}/app-release.json`;
  const response=await fetch(endpoint);if(!response.ok)throw Error('App metadata unavailable: '+appId);
  const record=await response.json();
  if(record.appId!==appId||record.version!==version||record.repository!==repository)throw Error('App metadata does not match its repository');
  const {trustedDownload}=require('../electron/security.cjs');trustedDownload(record.url,appId);
  const ticket=Buffer.from(JSON.stringify({purpose:'bluecloud-app-download-v1',appId,version,expiresAt:expires.toISOString()}));
  const url=new URL('/functions/v1/app-release-download',config.supabaseUrl);
  url.searchParams.set('ticket',ticket.toString('base64url'));url.searchParams.set('signature',sign(null,ticket,key).toString('base64url'));
  releases.push({...record,sourceUrl:record.url,url:url.href});
}
const payload=JSON.stringify({schemaVersion:1,channel:config.channel,publishedAt:published.toISOString(),expiresAt:expires.toISOString(),releases});
const envelope={payload,signature:sign(null,Buffer.from(payload),key).toString('base64')};
require('../electron/security.cjs').verifyFeed(envelope,config.publicKey,config.channel,require('../package.json').version);
await writeFile(path.join(output,'alpha-feed.json'),JSON.stringify(envelope,null,2)+'\n');
await writeFile(path.join(output,'promote-feed.sql'),`insert into public.bluecloud_release_channels(channel,envelope,published,updated_at) values ('${config.channel}','${JSON.stringify(envelope).replaceAll("'","''")}'::jsonb,true,now()) on conflict(channel) do update set envelope=excluded.envelope,published=true,updated_at=now();\n`);
console.log('Signed per-app feed prepared. No backend state changed.');
