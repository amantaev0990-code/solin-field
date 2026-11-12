'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {chromium,devices}=require('playwright');
const root=path.resolve(process.argv[2]||'www');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep))throw Error('bad path');
 const bytes=await fs.readFile(file);
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(bytes);
 }catch{if(!res.headersSent)res.writeHead(404).end();else res.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:process.env.SOLIN_BROWSER_CHANNEL});
  const page=await browser.newPage({...devices['Pixel 7'],viewport:{width:1133,height:728}});
  await page.route(u=>u.hostname!=='127.0.0.1',route=>route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>await window.SolinWorkspace.ready);
  const main=page.locator('#mainScreen');
  await main.waitFor({state:'visible'});
  const initial=await page.evaluate(async()=>({active:window.SolinWorkspace.activeId,
    forests:await window.SolinWorkspace.list(),screen:document.querySelector('.screen.active')?.id,
    context:document.querySelector('#mainScreen .field-context')?.outerHTML.slice(0,1900),
    header:document.querySelector('.topbar .brand')?.outerHTML.slice(0,1000)}));
  console.log('V54_FOREST_CONTEXT '+JSON.stringify({screen:initial.screen,id:initial.active,context:initial.context,header:initial.header}));
  assert.equal(initial.screen,'mainScreen');
  assert.ok(initial.active&&initial.forests.length);
  assert.equal(await page.locator('#solin-switch-forest').count(),0,'No V53 duplicate green button');
  const select=page.locator('#mainScreen .field-context select');
  assert.equal(await select.count(),1,'The native white forest selector must remain');
  assert.ok(await select.isVisible());
  assert.equal(await select.inputValue(),initial.active,'Native dropdown selects active forest at startup');
  assert.equal(await select.locator('option').count(),initial.forests.length+1,'Dropdown lists all stored forests');
  const activeForest=initial.forests.find(f=>f.id===initial.active);
  const caption=page.locator('.topbar .solin-active-forest-caption');
  assert.ok(await caption.isVisible(),'Visible name under brand logo');
  assert.ok((await caption.innerText()).includes(activeForest.org.NOS),'Active forestry caption matches selection');
  const contextText=await main.locator('.field-context').innerText();
  assert.ok(contextText.includes(activeForest.org.NLX),'Original context panel owner must not show a dash');
  // Add another offline forestry dataset only inside isolated Playwright profile.
  // Reopen and verify selecting a different forestry ID actually activates it.
  const alternateId=await page.evaluate(async()=>{
   const source=(await window.SolinWorkspace.list())[0];
   const alt=JSON.parse(JSON.stringify(source));
   alt.org.LESN=97;alt.org.NOS='Проверочное лесничество';
   alt.id=String(alt.org.POS)+'::97';
   alt.quarters={'997':{meta:{KV:997,KGLF:1},quarterRows:[],compartments:[]}};
   const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('SOLIN_WORKSPACES_V1',2);
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
   });
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('forests','readwrite');
    tx.objectStore('forests').put(alt);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });db.close();return alt.id;
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>await window.SolinWorkspace.ready);
  assert.equal(await select.locator('option').count(),3,'Original dropdown shows second taxator forest');
  assert.equal(await select.inputValue(),initial.active,'Last active forest not overwritten by new entry');
  await select.selectOption(alternateId);
  await page.waitForFunction(id=>window.SolinWorkspace.activeId===id,alternateId,{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('.topbar .solin-active-forest-caption')?.textContent.includes('Проверочное лесничество'));
  assert.equal(await select.inputValue(),alternateId);
  for(const route of ['quartersScreen','mapScreen','refsScreen','menuScreen','mainScreen']){
   await page.evaluate(name=>window.show(name),route);
   await page.waitForFunction(name=>document.getElementById(name)?.classList.contains('active'),route);
   assert.ok(await caption.isVisible(),'Forest name shown while visiting '+route);
   assert.ok((await caption.innerText()).includes('Проверочное лесничество'),'Wrong forest on '+route);
  }
  await select.selectOption(initial.active);
  await page.waitForFunction(id=>window.SolinWorkspace.activeId===id,initial.active);
  assert.ok((await caption.innerText()).includes(activeForest.org.NOS));
  console.log('V54 PASS: one white selector, all saved forests, correct owner and header across all screens, second forest switching and original selection restored.');
 }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
