const crypto = require('node:crypto');
const path = require('node:path');
const semver = require('semver');
const REPOSITORIES = require('../config.json').repositories;
const IDS = new Set(['coneic','quranly','tooldeck','launcher']);
function validAppId(id){return typeof id==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(id)&&! /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(id);}
function safePath(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes(':') || path.posix.isAbsolute(relative) || relative.split('/').some(s=>s==='..'||s==='.'||!s)) throw Error('Invalid package path');
  if(relative.split('/').some(s=>/[<>:"|?*\x00-\x1f]/.test(s)||/[. ]$/.test(s)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)))throw Error('Invalid Windows package path');
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw Error('Package path escapes library');
  return resolved;
}
function trustedDownload(input,appId) {
  const url = new URL(input);
  const trusted = ['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com','rplxdjpbsbhorpucacic.supabase.co'];
  if (url.protocol !== 'https:' || !trusted.includes(url.hostname) || url.username || url.password || url.port) throw Error('Untrusted package location');
  if(url.hostname==='github.com'){
    const match=url.pathname.match(/^\/([^/]+\/[^/]+)\/releases\/download\/[^/]+\/[^/]+$/);
    if(!match || !Object.values(REPOSITORIES).includes(match[1]) || (REPOSITORIES[appId] && match[1]!==REPOSITORIES[appId]))throw Error('Package is outside its app repository');
  }
  return url;
}
function verifyFeed(envelope, publicKey, channel, currentVersion, now=Date.now()) {
  if (!envelope || typeof envelope.payload!=='string'||typeof envelope.signature!=='string'||envelope.payload.length>1000000) throw Error('Invalid release feed');
  if (!crypto.verify(null,Buffer.from(envelope.payload),publicKey,Buffer.from(envelope.signature,'base64'))) throw Error('Release signature is invalid');
  const feed=JSON.parse(envelope.payload);
  if(feed.schemaVersion!==1||feed.channel!==channel||!Array.isArray(feed.releases)||feed.releases.length>100) throw Error('Unsupported release feed');
  const published=Date.parse(feed.publishedAt), expires=Date.parse(feed.expiresAt);
  if(!Number.isFinite(published)||!Number.isFinite(expires)||published>now+300000||expires<=now||expires<=published) throw Error('Release feed is expired or not yet valid');
  const seen=new Set();
  for(const r of feed.releases) {
    if(!validAppId(r.appId)||seen.has(r.appId)||r.platform!=='win32'||r.arch!=='x64'||!semver.valid(r.version)||!semver.valid(r.minimumLauncher)) throw Error('Unsupported app release');
    seen.add(r.appId);
    if(!Number.isSafeInteger(r.size)||r.size<1||r.size>1500000000||!/^[a-f0-9]{64}$/.test(r.sha256)) throw Error('Invalid package integrity data');
    if(r.appId==='launcher' ? r.packageType!=='nsis' : r.packageType!=='zip') throw Error('Unsupported package type');
    if(r.appId!=='launcher') { safePath('C:/BlueCloud',r.executable); if(!r.executable.endsWith('.exe'))throw Error('Missing app executable'); }
    if(!Number.isSafeInteger(r.unpackedSize)||r.unpackedSize<1||r.unpackedSize>4000000000) throw Error('Invalid expanded package size');
    trustedDownload(r.url,r.appId);
  }
  return feed;
}
module.exports={safePath,trustedDownload,verifyFeed,IDS,validAppId};
