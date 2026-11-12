'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {chromium,devices}=require('playwright');
const root=path.resolve(process.argv[2]||'www');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep))throw Error('Bad path');
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(await fs.readFile(file));
 }catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:process.env.SOLIN_BROWSER_CHANNEL});
  const url='http://127.0.0.1:'+server.address().port+'/';
  const context=await browser.newContext({...devices['Pixel 7'],viewport:{width:1067,height:667}});
  const page=await context.newPage();
  await page.route(u=>u.hostname!=='127.0.0.1',route=>route.abort());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  const first=await page.evaluate(async()=>{
   await window.SolinWorkspace.ready;
   const forests=await window.SolinWorkspace.list();
   return {id:window.SolinWorkspace.activeId,forests:forests.length,
    active:document.querySelector('.screen.active')?.id,
    stands:Object.values(D.quarters||{}).reduce((n,q)=>n+(q.compartments?.length||0),0)};
  });
  assert.ok(first.id&&first.forests>=1&&first.stands>0,'Existing bundled/selected forest loaded on first launch');
  assert.equal(first.active,'mainScreen','Cold boot must display the main menu, not forestry chooser');
  const switcher=page.locator('#solin-switch-forest');
  assert.equal(await switcher.count(),1,'Visible forest chooser must exist in main menu');
  assert.ok(await switcher.isVisible(),'Forest chooser must be visible');
  await switcher.click();
  await page.waitForFunction(()=>document.querySelector('#homeScreen.active'));
  const options=page.locator('#forestList .forest-entry > .forest-option');
  assert.ok(await options.count()>=1,'Saved forestry workspaces must appear in selector');
  await options.first().click();
  await page.waitForFunction(()=>document.querySelector('#mainScreen.active'));
  assert.equal(await page.evaluate(()=>window.SolinWorkspace.activeId),first.id);
  // Exercise a real main-menu route with a genuine pointer event; a guarded
  // click must never bounce the user back to the owner/forestry chooser.
  const quarters=page.locator('#mainScreen [data-field-route="quartersScreen"]');
  assert.ok(await quarters.isVisible(),'Main-menu quarter button must be visible');
  const rect=await quarters.boundingBox();
  assert.ok(rect&&rect.width>0&&rect.height>0);
  await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.waitForFunction(()=>document.querySelector('#quartersScreen.active'),null,{timeout:10000});
  await page.locator('#homeButton').click();
  await page.waitForFunction(()=>document.querySelector('#mainScreen.active'));
  // Checkpoint and original local work must survive application updates.
  await page.evaluate(()=>localStorage.setItem('solin_user_data_v1',
    JSON.stringify({quarters:{'999':{compartments:[{VD:'1',PLV:1}]}}})));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>await window.SolinWorkspace.ready);
  assert.equal(await page.evaluate(()=>document.querySelector('.screen.active')?.id),'mainScreen','Reload must return to working main menu');
  assert.equal(await page.evaluate(()=>window.SolinWorkspace.activeId),first.id,'Last forest selection must persist');
  assert.ok(await page.evaluate(()=>localStorage.getItem('solin_user_data_v1')!==null),
   'Never automatically purge legacy user edits');
  await context.close();
  // Simulate an upgraded device that says initialized but IndexedDB is empty.
  // Offer recovery instead of deleting the last local records or showing a dead menu.
  const emptyContext=await browser.newContext({...devices['Pixel 7'],viewport:{width:1067,height:667}});
  await emptyContext.addInitScript(()=>{
   localStorage.setItem('solin_workspaces_initialized_v1','1');
   localStorage.removeItem('solin_field_checkpoint_v2');
  });
  const emptyPage=await emptyContext.newPage();
  await emptyPage.route(u=>u.hostname!=='127.0.0.1',route=>route.abort());
  await emptyPage.goto(url,{waitUntil:'domcontentloaded'});
  await emptyPage.evaluate(async()=>await window.SolinWorkspace.ready);
  assert.equal(await emptyPage.evaluate(()=>document.querySelector('.screen.active')?.id),
   'homeScreen','No saved forest must show meaningful recovery screen');
  assert.equal(await emptyPage.locator('#forestList .forest-entry').count(),0,'No fake saved forests');
  const restore=emptyPage.locator('#solin-restore-source-forest');
  assert.ok(await restore.isVisible(),'Recovery from included offline dataset must be offered');
  await restore.click();
  await emptyPage.waitForFunction(()=>document.querySelector('#mainScreen.active'),null,{timeout:10000});
  assert.equal(await emptyPage.evaluate(async()=>(await window.SolinWorkspace.list()).length),1);
  await emptyContext.close();
  console.log('V53 PASS: real cold start -> main menu; buttons; visible forest chooser; reload; no legacy data deletion; empty-store recovery.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
