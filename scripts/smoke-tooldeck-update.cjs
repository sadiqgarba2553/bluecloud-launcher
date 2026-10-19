// Real signed public update, confined to disposable profiles in artifacts/.
const {expect,_electron:electron}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path');
const {extractPackage}=require('../electron/extract.cjs');
const artifacts=path.resolve(__dirname,'../../../artifacts');
(async()=>{
  const work=await fs.mkdtemp(path.join(artifacts,'managed-tooldeck-update-'));
  const profile=path.join(work,'launcher-profile'),toolProfile=path.join(work,'tool-profile');let launcher,tool;
  try{
    const oldReleaseDir=path.join(artifacts,'app-releases/launcher-v0.1.0-alpha.1');
    const envelope=JSON.parse(await fs.readFile(path.join(oldReleaseDir,'alpha-feed.json'),'utf8'));
    const old=JSON.parse(envelope.payload).releases.find(r=>r.appId==='tooldeck');
    const directory='tooldeck/previous-version';
    await extractPackage(path.join(oldReleaseDir,'tooldeck-0.1.0-alpha.1-win-x64.zip'),path.join(profile,'library',directory),old.unpackedSize,new AbortController().signal);
    await fs.writeFile(path.join(profile,'installed.json'),JSON.stringify({tooldeck:{version:old.version,directory,executable:old.executable,installedAt:new Date().toISOString()}}));
    tool=await electron.launch({executablePath:path.join(profile,'library',directory,old.executable),args:[`--user-data-dir=${toolProfile}`]});
    let page=await tool.firstWindow();await page.getByRole('button',{name:'JSON formatter',exact:true}).waitFor();
    await page.evaluate(()=>localStorage.setItem('tooldeck-migration-proof','retained-through-launcher-update'));
    await tool.close();tool=null;
    launcher=await electron.launch({executablePath:path.join(artifacts,'launcher/win-unpacked/BlueCloud Launcher.exe'),args:[`--user-data-dir=${profile}`]});
    page=await launcher.firstWindow();await page.getByRole('button',{name:'Check for updates'}).click();
    await expect(page.getByRole('button',{name:'Update 1 app',exact:true})).toBeVisible({timeout:30000});
    await page.getByRole('button',{name:'Update 1 app',exact:true}).click();
    const version=require('../../tooldeck/package.json').version;let entry,last='';const deadline=Date.now()+20*60*1000;
    while(Date.now()<deadline){
      const state=(await page.evaluate(()=>window.bluecloud.state())).state;
      if(state.appErrors.tooldeck)throw Error(state.appErrors.tooldeck);
      if(state.installed.tooldeck?.version===version){entry=state.installed.tooldeck;break;}
      const progress=(await page.locator('.progress-text').allTextContents()).join(' ');
      if(progress&&progress!==last){console.log(progress);last=progress;}
      await new Promise(resolve=>setTimeout(resolve,2000));
    }
    if(!entry)throw Error('Public Tooldeck update timed out');
    await expect(page.getByRole('button',{name:'Open app ↗',exact:true})).toHaveCount(1);
    tool=await electron.launch({executablePath:path.join(profile,'library',entry.directory,entry.executable),args:[`--user-data-dir=${toolProfile}`]});
    const toolPage=await tool.firstWindow();await expect(toolPage.locator('.tool-card')).toHaveCount(79);
    expect(await toolPage.evaluate(()=>localStorage.getItem('tooldeck-migration-proof'))).toBe('retained-through-launcher-update');
    console.log(`Public signed Tooldeck ${old.version} → ${version} update installed, shows Open, launches 79 cards, and retains existing preferences.`);
  }finally{
    if(tool)await tool.close();if(launcher)await launcher.close();
    if(!work.startsWith(artifacts+path.sep))throw Error('Unsafe cleanup');
    await fs.rm(work,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
