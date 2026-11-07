// Promote only tested Linux artifacts whose GitHub digests match workflow checksums.
import {spawnSync} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),config=JSON.parse(await readFile(path.join(root,'config.json')));
const [id,version,runId]=process.argv.slice(2),repo=config.repositories[id],tag='linux-v'+version;
if(!repo||!/^\d+\.\d+\.\d+$/.test(version)||!/^\d+$/.test(runId))throw Error('Expected app ID, Linux version and successful build run ID');
function gh(args){const r=spawnSync('gh',args,{encoding:'utf8'});if(r.status)throw Error(r.stderr||'GitHub command failed');return r.stdout;}
const run=JSON.parse(gh(['run','view',runId,'--repo',repo,'--json','jobs,headSha']));
const tagRef=JSON.parse(gh(['api',`repos/${repo}/git/ref/tags/${tag}`]));if(tagRef.object.sha!==run.headSha)throw Error('Linux build does not match release source tag');
if(!run.jobs.some(j=>['build','linux'].includes(j.name)&&j.conclusion==='success'))throw Error('Linux build job has not succeeded');
const releaseId=JSON.parse(gh(['release','view',tag,'--repo',repo,'--json','databaseId'])).databaseId;
const release=JSON.parse(gh(['api',`repos/${repo}/releases/${releaseId}`]));
if(release.tag_name!==tag)throw Error('Release tag mismatch');
const directory=path.join(root,'.release/verified',id);await mkdir(directory,{recursive:true});
gh(['release','download',tag,'--repo',repo,'--dir',directory,'--pattern','SHA256SUMS-linux-x64.txt','--pattern','app-release-linux.json','--pattern','LINUX-README.md','--clobber']);
const sums=(await readFile(path.join(directory,'SHA256SUMS-linux-x64.txt'),'utf8')).trim().split(/\r?\n/).map(line=>{const m=line.match(/^([a-f0-9]{64})  (.+)$/);if(!m||m[2].includes('/')||m[2].includes('\\'))throw Error('Invalid release checksum line');return {hash:m[1],name:m[2]};});
if(!sums.some(s=>s.name.endsWith('.deb'))||sums.filter(s=>s.name.endsWith('.AppImage')).length!==1||!sums.some(s=>s.name==='app-release-linux.json'))throw Error('Incomplete Linux package checksums');
for(const {hash,name}of sums){const asset=release.assets.find(a=>a.name===name);if(!asset||asset.state!=='uploaded'||asset.size<1||asset.digest!=='sha256:'+hash)throw Error('Uploaded Linux artifact integrity failure: '+name);if(['app-release-linux.json','LINUX-README.md'].includes(name)&&createHash('sha256').update(await readFile(path.join(directory,name))).digest('hex')!==hash)throw Error('Downloaded metadata integrity failure');}
const metadata=JSON.parse(await readFile(path.join(directory,'app-release-linux.json'))),image=release.assets.find(a=>a.name.endsWith('.AppImage'));
if(metadata.appId!==id||metadata.version!==version||metadata.repository!==repo||metadata.platform!=='linux'||metadata.arch!=='x64'||metadata.sha256!==image.digest.slice(7)||metadata.size!==image.size)throw Error('Managed Linux metadata mismatch');
if(release.draft)gh(['release','edit',tag,'--repo',repo,'--draft=false','--prerelease','--latest=false']);
for(const name of ['app-release-linux.json',image.name]){const url=`https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`,response=await fetch(url,{method:'HEAD'});if(!response.ok)throw Error('Public Linux asset unavailable: '+name);}
console.log('Published verified Linux release: https://github.com/'+repo+'/releases/tag/'+tag);
