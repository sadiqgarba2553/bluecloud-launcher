import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),config=JSON.parse(await readFile(new URL('../config.json',import.meta.url),'utf8'));
const endpoint=new URL('/rest/v1/bluecloud_release_channels',config.supabaseUrl);endpoint.search=new URLSearchParams({channel:'eq.'+config.channel,published:'eq.true',select:'envelope'});
const response=await fetch(endpoint,{headers:{apikey:config.publishableKey},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Public feed unavailable');
const rows=await response.json();const {verifyFeed,trustedDownload}=require('../electron/security.cjs');
const feed=verifyFeed(rows[0]?.envelope,config.publicKey,config.channel,require('../package.json').version);
for(const release of feed.releases){
  if(release.sourceUrl)trustedDownload(release.sourceUrl,release.appId);
  const result=await fetch(release.url,{method:'HEAD',signal:AbortSignal.timeout(30000)});
  if(!result.ok||Number(result.headers.get('content-length'))!==release.size)throw Error('Public download failed: '+release.appId);
  trustedDownload(result.url);
  console.log(`Verified ${release.appId} ${release.version}: ${release.repository||config.repositories[release.appId]}`);
}
