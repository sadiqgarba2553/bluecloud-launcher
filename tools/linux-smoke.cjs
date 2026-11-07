const { _electron:electron }=require('playwright-core');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const profile=await fs.mkdtemp(path.join(os.tmpdir(),'bluecloud-linux-ui-'));let app;try{
 app=await electron.launch({args:[path.resolve(__dirname,'..'),'--user-data-dir='+profile],env:{...process.env,BLUECLOUD_SYSTEM_PACKAGES:'0'}});
 const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#count-all')?.textContent==='5');
 const text=await page.locator('body').innerText();for(const name of ['Doc Cloud','Sheet Cloud','Slide Cloud','Canvas Cloud','Tooldeck'])assert.ok(text.includes(name),name);
 assert.ok(text.includes('LINUX / X86_64'));const result=await page.evaluate(()=>window.bluecloud.state());assert.equal(result.state.platform,'linux');assert.equal(result.state.systemManaged,undefined);console.log('Linux launcher renders all five apps and exposes portable Linux state.');
}finally{await app?.close();await fs.rm(profile,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
