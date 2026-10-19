// Public signed update with previous Quranly progress in disposable profiles.
const {expect,_electron:electron}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path');
const {extractPackage}=require('../electron/extract.cjs');
const appDir=path.resolve(__dirname,'..'),artifacts=path.join(appDir,'.release/validation'),fixtureRoot=process.env.BLUECLOUD_UPGRADE_FIXTURES||path.join(appDir,'.release/fixtures');
(async()=>{
  await fs.mkdir(artifacts,{recursive:true});
  const work=await fs.mkdtemp(path.join(artifacts,'managed-quranly-update-')),profile=path.join(work,'launcher-profile'),quranProfile=path.join(work,'quranly-profile');let launcher,quranly;
  try{
    const oldDir=path.join(fixtureRoot,'app-releases/launcher-v0.1.0-alpha.1'),envelope=JSON.parse(await fs.readFile(path.join(oldDir,'alpha-feed.json'),'utf8'));
    const old=JSON.parse(envelope.payload).releases.find(r=>r.appId==='quranly'),directory='quranly/previous-version';
    await extractPackage(path.join(oldDir,`quranly-${old.version}-win-x64.zip`),path.join(profile,'library',directory),old.unpackedSize,new AbortController().signal);
    await fs.writeFile(path.join(profile,'installed.json'),JSON.stringify({quranly:{version:old.version,directory,executable:old.executable,installedAt:new Date().toISOString()}}));
    quranly=await electron.launch({executablePath:path.join(profile,'library',directory,old.executable),args:[`--user-data-dir=${quranProfile}`]});let page=await quranly.firstWindow();
    await page.evaluate(()=>{localStorage.setItem('quranly_onboarded','true');localStorage.setItem('quranly_daily_goal','20');localStorage.setItem('quranly-collection-upgrade-proof','retained');});await page.reload();await page.locator('.home-page').waitFor();await quranly.close();quranly=null;
    launcher=await electron.launch({executablePath:path.join(appDir,'release/win-unpacked/BlueCloud Launcher.exe'),args:[`--user-data-dir=${profile}`]});page=await launcher.firstWindow();await page.getByRole('button',{name:'Check for updates'}).click();await expect(page.getByRole('button',{name:'Update 1 app',exact:true})).toBeVisible({timeout:30000});await page.getByRole('button',{name:'Update 1 app',exact:true}).click();
    const version=require('../products.json').find(p=>p.id==='quranly').version;let entry,last='';const deadline=Date.now()+20*60*1000;
    while(Date.now()<deadline){const state=(await page.evaluate(()=>window.bluecloud.state())).state;if(state.appErrors.quranly)throw Error(state.appErrors.quranly);if(state.installed.quranly?.version===version){entry=state.installed.quranly;break;}const progress=(await page.locator('.progress-text').allTextContents()).join(' ');if(progress&&progress!==last){console.log(progress);last=progress;}await new Promise(r=>setTimeout(r,2000));}
    if(!entry)throw Error('Public Quranly update timed out');await expect(page.getByRole('button',{name:'Open app ↗',exact:true})).toHaveCount(1);
    const link=await launcher.evaluate(({shell},file)=>shell.readShortcutLink(file),path.join(profile,'start-menu/quranly/Quranly PC.lnk'));expect(link.target.toLowerCase()).toContain(version);
    quranly=await electron.launch({executablePath:path.join(profile,'library',entry.directory,entry.executable),args:[`--user-data-dir=${quranProfile}`]});page=await quranly.firstWindow();await page.locator('.home-page').waitFor();
    expect(await page.evaluate(()=>localStorage.getItem('quranly_daily_goal'))).toBe('20');expect(await page.evaluate(()=>localStorage.getItem('quranly-collection-upgrade-proof'))).toBe('retained');await page.evaluate(()=>{location.hash='#/downloads';});await page.locator('#download-reciter').waitFor();expect(await page.evaluate(()=>typeof window.quranlyDesktop.collections.start)).toBe('function');
    console.log(`Public signed Quranly ${old.version} -> ${version} installed, shows Open, retargets Windows shortcut and preserves the previous profile and daily goal.`);
  }finally{if(quranly)await quranly.close();if(launcher)await launcher.close();if(!work.startsWith(artifacts+path.sep))throw Error('Unsafe cleanup');await fs.rm(work,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1;});
