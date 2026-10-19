const $=id=>document.getElementById(id);
let current,filter='all',view=localStorage.getItem('bluecloud-view')||'grid',uiError='';
let bulkRunning=false,lastCheck=0;
const jobs=new Map();
const asset={coneic:'coneic.png',quranly:'quranly.png',tooldeck:'tooldeck.png'};
function element(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
function updateAvailable(p){const release=current.releases.find(r=>r.appId===p.id);return Boolean(current.installed[p.id]&&release?.updateAvailable);}
function notice(){const message=uiError||current?.error||'';$('notice').textContent=message;$('notice').hidden=!message;}
async function action(name,id){
  if(name==='uninstall')document.querySelectorAll('.more-menu[open]').forEach(d=>d.open=false);
  let ok=false;
  uiError='';if(name==='install'||name==='uninstall'){jobs.set(id,{phase:name==='install'?'Preparing':'Removing',percent:0});render();}
  try{const result=await window.bluecloud[name](id);if(!result.ok)throw Error(result.error);current=result.state;ok=!current.paused?.includes(id);if(name==='install'&&!ok)uiError='Download paused. Resume it when you are ready.';if(name==='refresh')lastCheck=Date.now();if(name==='install'&&id!=='launcher'&&ok)uiError=`${current.products.find(p=>p.id===id)?.name||'App'} is ready to open.`;}
  catch(error){uiError=error.message;}
  finally{jobs.delete(id);if(['install','uninstall','cancel'].includes(name)){try{const result=await window.bluecloud.state();if(result.ok)current=result.state;}catch{}}if(current)render();else notice();}
  return ok;
}
const batch=element('div','batch-actions'),installAll=element('button','secondary','Install all apps'),updateAll=element('button','secondary','Update all'),uninstallAll=element('button','secondary','Uninstall all apps');
batch.append(installAll,updateAll,uninstallAll);document.querySelector('.library-note').insertBefore(batch,$('channel'));
uninstallAll.onclick=async()=>{if(jobs.size||bulkRunning)return;bulkRunning=true;render();try{await action('uninstallAll');}finally{bulkRunning=false;render();}};
async function runBatch(update){if(bulkRunning||jobs.size)return;const candidates=current.products.filter(p=>p.id!=='launcher'&&(update?updateAvailable(p):!current.installed[p.id]&&current.releases.some(r=>r.appId===p.id&&!r.requiresLauncher)));bulkRunning=true;render();let completed=0;try{for(const p of candidates){if(!await action('install',p.id))return;completed++;}uiError=`${completed} app${completed===1?' is':'s are'} ready to open.`;}finally{bulkRunning=false;render();}}
installAll.onclick=()=>runBatch(false);updateAll.onclick=()=>runBatch(true);
function button(label,actionName,id,className='primary') {const b=element('button',className,label);b.dataset.action=actionName;b.dataset.app=id;b.onclick=()=>action(actionName,id);return b;}
function links(p){const group=element('div','app-links');for(const [label,kind]of [['Website ↗','website'],['Source ↗','source']]){const b=element('button','link-button',label);b.onclick=()=>action('openLink',{id:p.id,kind});group.append(b);}return group;}
function more(p,release,installed,busy){const detail=element('details','more-menu'),summary=element('summary','','•••');summary.setAttribute('aria-label',`More options for ${p.name}`);detail.dataset.app=p.id;const panel=element('div','menu-panel');panel.setAttribute('aria-label',`${p.name} actions`);const notes=element('button','','Release notes');notes.onclick=()=>{detail.open=false;uiError=release?.notes||p.note;notice();};panel.append(notes);if(installed?.previous){const restore=button('Restore previous version','rollback',p.id,'secondary');restore.disabled=busy;panel.append(restore);}if(installed){const remove=button('Uninstall app','uninstall',p.id,'danger');remove.disabled=busy;panel.append(remove);}detail.append(summary,panel);return detail;}
function status(p,release,installed){if(current.paused?.includes(p.id))return ['Download paused - Resume available','paused'];if(release?.requiresLauncher)return ['Launcher update required','update'];if(jobs.has(p.id))return ['Working','working'];if(current.appErrors?.[p.id])return [installed?.broken?'Repair needed':'Last operation failed','failed'];if(!installed)return [release?'Ready to install':'Release being prepared','available'];return [updateAvailable(p)?'Update available':'Installed · Up to date',updateAvailable(p)?'update':'installed'];}
function actions(p,release,installed,busy){
  const group=element('div','app-actions'),paused=current.paused?.includes(p.id);
  if(installed){const open=button('Open app \u2197','launch',p.id);open.disabled=busy;group.append(open);}
  if(paused){const resume=button('Resume download','install',p.id);resume.disabled=busy;group.append(resume);group.append(button('Cancel download','cancel',p.id,'cancel-button'));}
  else if(!installed||updateAvailable(p)){
    const label=release?.requiresLauncher?'Update Launcher first':installed?'Update \u2193':release?'Install app \u2193':'Coming soon';
    const install=release?.requiresLauncher?button(label,current.selfUpdate?.phase==='ready'?'restartUpdate':'install',current.selfUpdate?.phase==='ready'?undefined:'launcher'):button(label,'install',p.id,installed?'update-button':'primary');
    install.disabled=busy||!release||release?.requiresLauncher&&current.selfUpdate?.phase==='restarting';group.append(install);
  }
  group.append(more(p,release,installed,busy));
  if(jobs.has(p.id)||current.busy.includes(p.id)){if(jobs.get(p.id)?.phase==='Downloading')group.append(button('Pause','pause',p.id,'secondary'));group.append(button('Cancel','cancel',p.id,'cancel-button'));}
  return group;
}
function progressBlock(p){const block=element('div','download-progress');block.dataset.progress=p.id;block.hidden=!jobs.has(p.id);const text=element('span','progress-text'),bar=element('progress');bar.max=100;bar.setAttribute('aria-label',`${p.name} installation progress`);block.append(text,bar);return block;}
function paintProgress(id){
  const block=document.querySelector(`[data-progress="${id}"]`),job=jobs.get(id);if(!block||!job)return;block.hidden=false;
  block.querySelector('.progress-text').textContent=job.phase==='Downloading'?`${job.percent}% \u00b7 ${((job.bytes||0)/1048576).toFixed(1)} / ${((job.totalBytes||0)/1048576).toFixed(1)} MB${job.speed>0?` \u00b7 ${(job.speed/1048576).toFixed(1)} MB/s`:''}${Number.isFinite(job.eta)?` \u00b7 ${job.eta<60?job.eta+'s':Math.ceil(job.eta/60)+' min'} remaining`:''}`:job.phase;
  block.querySelector('progress').value=job.percent;
}
function appIdentity(p){const identity=element('div','app-identity'),img=asset[p.id]?element('img','app-icon'):element('span','app-icon generic-icon','▦');if(asset[p.id]){img.src=`assets/${asset[p.id]}`;img.alt='';}const text=element('div','identity-text');text.append(element('h2','',p.name),element('p','',p.category));identity.append(img,text);return identity;}
function render(){
  if(!current)return;const openMenus=[...document.querySelectorAll('.more-menu[open]')].map(d=>d.dataset.app);const focus=document.activeElement;const restore=focus?.dataset.action?{action:focus.dataset.action,app:focus.dataset.app}:null;
  const products=current.products.filter(p=>p.id!=='launcher');const counts={all:products.length,installed:products.filter(p=>current.installed[p.id]).length,updates:products.filter(updateAvailable).length,available:products.filter(p=>!current.installed[p.id]).length};
  for(const [key,count]of Object.entries(counts)){$(`count-${key}`).textContent=count;$(key).setAttribute('aria-selected',String(filter===key));$(key).tabIndex=filter===key?0:-1;}
  const installable=products.filter(p=>!current.installed[p.id]&&current.releases.some(r=>r.appId===p.id&&!r.requiresLauncher));installAll.hidden=!installable.length;installAll.textContent=bulkRunning?'Working…':(installable.length===1?'Install 1 app':`Install all ${installable.length} apps`);installAll.disabled=bulkRunning||jobs.size>0||current.selfUpdate?.phase==='restarting';updateAll.hidden=!counts.updates;updateAll.textContent=(counts.updates===1?'Update 1 app':`Update all ${counts.updates} apps`);updateAll.disabled=bulkRunning||jobs.size>0||current.selfUpdate?.phase==='restarting';
  uninstallAll.hidden=!counts.installed;uninstallAll.textContent=`Uninstall all ${counts.installed} app${counts.installed===1?'':'s'}`;uninstallAll.disabled=bulkRunning||jobs.size>0||current.busy.length>0||current.bulkRemoving||current.selfUpdate?.phase==='restarting';$('auto-check').checked=current.autoUpdate!==false;
  $('version').textContent=`BLUECLOUD ${current.version}`;$('channel').textContent=`${current.channel.toUpperCase()} CHANNEL`;$('summary').textContent=`${counts.installed} INSTALLED · ${counts.updates} UPDATE${counts.updates===1?'':'S'} AVAILABLE`;$('connection').textContent=current.error?(current.releases.length?'Using saved release information':'Installed apps work offline'):'Release information up to date';
  $('grid').setAttribute('aria-pressed',String(view==='grid'));$('table').setAttribute('aria-pressed',String(view==='table'));notice();
  const q=$('search').value.trim().toLowerCase();const list=products.filter(p=>(filter==='all'||filter==='installed'&&current.installed[p.id]||filter==='updates'&&updateAvailable(p)||filter==='available'&&!current.installed[p.id])&&`${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q));
  if($('sort').value==='name')list.sort((a,b)=>a.name.localeCompare(b.name));if($('sort').value==='installed')list.sort((a,b)=>Number(Boolean(current.installed[b.id]))-Number(Boolean(current.installed[a.id])));
  $('library').replaceChildren();$('library').className=view==='table'?'app-table':'app-grid';$('library').hidden=!list.length;$('empty').hidden=Boolean(list.length);$('empty-description').textContent=filter==='updates'&&!q?'Your installed apps are up to date.':'Try another filter or search.';
  if(view==='table'&&list.length){const heading=element('div','table-heading');['Application','Status','Version','Actions'].forEach(t=>heading.append(element('span','',t)));$('library').append(heading);}
  for(const p of list){const release=current.releases.find(r=>r.appId===p.id),installed=current.installed[p.id],busy=jobs.has(p.id)||current.busy.includes(p.id)||current.selfUpdate?.phase==='restarting';const [statusText,statusClass]=status(p,release,installed);const card=element('article',`app-card ${p.id}`);card.setAttribute('aria-label',p.name);card.setAttribute('aria-busy',String(busy));
    if(view==='grid'){const top=element('div','card-top');top.append(element('span','app-number',String(products.indexOf(p)+1).padStart(2,'0')),links(p));card.append(top);const body=element('div','card-body');body.append(appIdentity(p),element('p','app-description',p.description),element('span',`app-status ${statusClass}`,statusText),element('p','app-version',`${installed?'Installed':'Version'} ${installed?.version||release?.version||p.version} · Windows x64`),progressBlock(p),actions(p,release,installed,busy));card.append(body);}
    else{card.append(appIdentity(p),element('span',`app-status ${statusClass}`,statusText),element('span','app-version',installed?.version||release?.version||p.version),actions(p,release,installed,busy),progressBlock(p));}
    $('library').append(card);paintProgress(p.id);
    if(installed?.broken){const b=card.querySelector('[data-action="launch"]');if(b){b.textContent='Repair app';b.dataset.action='install';b.onclick=()=>action('install',p.id);}}
    if(current.appErrors?.[p.id]){const error=element('p','app-error',current.appErrors[p.id]);error.setAttribute('role','alert');(card.querySelector('.card-body')||card).append(error);}
  }
  const self=current.releases.find(r=>r.appId==='launcher'&&r.updateAvailable);$('self-update').hidden=!self&&!current.appErrors?.launcher;if(self){const ready=current.selfUpdate?.phase==='ready';$('self-update').replaceChildren(element('p','',current.selfUpdate?.phase==='restarting'?'Restarting to finish the launcher update…':ready?(current.selfUpdate.deferred?'Launcher update ready. Restart when you are ready.':`Launcher ${self.version} is ready. Restart now to finish, or choose Later.`):jobs.has('launcher')?'Downloading the launcher update in the background…':`Launcher ${self.version} will update automatically.`));if(ready)$('self-update').append(button('Restart now','restartUpdate',undefined,'secondary'),button('Later','deferUpdate',undefined,'secondary'));else if(!jobs.has('launcher'))$('self-update').append(button('Update launcher','install','launcher','secondary'));}if(current.appErrors?.launcher)$('self-update').append(element('p','app-error',current.appErrors.launcher));
  for(const id of openMenus){const menu=[...document.querySelectorAll('.more-menu')].find(d=>d.dataset.app===id);if(menu)menu.open=true;}
  if(restore)document.querySelector(`[data-action="${restore.action}"][data-app="${restore.app}"]`)?.focus({preventScroll:true});
}
for(const tab of document.querySelectorAll('[data-filter]')){tab.onclick=()=>{filter=tab.dataset.filter;render();};tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...document.querySelectorAll('[data-filter]')],index=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;filter=tabs[next].dataset.filter;render();tabs[next].focus();});}
for(const type of ['grid','table'])$(type).onclick=()=>{view=type;localStorage.setItem('bluecloud-view',type);render();};
$('search').addEventListener('input',render);$('sort').addEventListener('change',render);
$('reset-filters').onclick=()=>{filter='all';$('search').value='';render();};
$('refresh').onclick=async()=>{$('refresh').disabled=true;$('refresh').setAttribute('aria-label','Checking for updates');await action('refresh');$('refresh').disabled=false;$('refresh').setAttribute('aria-label','Check for updates');};
$('support').onclick=()=>action('openLink',{id:'launcher',kind:'support'});
$('auto-check').onchange=()=>action('setAutoUpdate',$('auto-check').checked);
$('settings-button').onclick=()=>$('settings').showModal();for(const id of ['close-settings','done-settings'])$(id).onclick=()=>$('settings').close();
document.addEventListener('click',event=>document.querySelectorAll('.more-menu[open]').forEach(d=>{if(!d.contains(event.target))d.open=false;}));
document.addEventListener('keydown',event=>{document.body.dataset.keyboard='true';if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('search').focus();}if(event.key==='Escape'){document.querySelectorAll('.more-menu[open]').forEach(d=>d.open=false);if(document.activeElement===$('search')){$('search').value='';render();}}});
document.addEventListener('pointerdown',()=>{delete document.body.dataset.keyboard;});
window.bluecloud.onProgress(data=>{if(data.phase==='Ready'){jobs.delete(data.id);return;}if(data.phase==='Finished'){jobs.delete(data.id);window.bluecloud.state().then(result=>{if(result.ok){current=result.state;render();}});return;}const changed=jobs.get(data.id)?.phase!==data.phase;jobs.set(data.id,data);if(changed)render();else paintProgress(data.id);});
window.bluecloud.onState(data=>{current=data;render();});
(async()=>{await action('state');await action('refresh');})();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&$('auto-check').checked&&current&&!jobs.size&&!bulkRunning&&Date.now()-lastCheck>30*60*1000)action('refresh');});
