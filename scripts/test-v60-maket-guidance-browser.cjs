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
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  const b=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(b);
 }catch{res.writeHead(404).end();}
});
(async()=>{
 let browser;
 try{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  browser=await chromium.launch({channel:process.env.SOLIN_BROWSER_CHANNEL});
  const page=await browser.newPage({...devices['Pixel 7'],viewport:{width:1100,height:730}});
  page.on('pageerror',e=>console.error('PAGE:',e.message));
  await page.route(url=>url.hostname!=='127.0.0.1',route=>route.abort());
  await page.addInitScript(()=>window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',Plugins:{}});
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SolinWorkspace?.ready&&window.SolinCardEditor&&window.SolinQuickCard);
  await page.evaluate(async()=>{
   await window.SolinWorkspace.ready;
   const id=window.SolinWorkspace.activeId;
   if(!id)throw Error('Missing active test forest');
   await window.SolinWorkspace.activate(id);
   const q=Object.values(D.quarters).find(q=>q.compartments?.length);
   if(!q)throw Error('No stand sample');
   const r={...q.compartments[0],KU:31,_children:{}};
   window.SolinCardEditor.open(r,{isNew:true,quick:true});
  });
  const hint=page.locator('#ce-required-makets');
  await hint.waitFor();
  assert.match(await hint.innerText(),/Категория 31/);
  assert.match(await hint.innerText(),/Дорога/);
  assert.match(await hint.innerText(),/не сверены/i);
  assert.equal(await hint.locator('button').count(),0,'Road category may not invent M31 or M1 mandatory buttons');
  assert.equal(await hint.getAttribute('data-maket-requirement-status'),'unverified');
  assert.ok(await page.getByRole('button',{name:'Все макеты'}).count()>0,'All makets should remain available');
  const ku=page.locator('#ce-form [data-ce-scope="base"][data-ce-field="KU"]');
  await ku.evaluate(el=>{el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('#ce-required-makets')?.textContent?.includes('Категория 1'));
  assert.equal(await hint.locator('button').count(),0,'No guessed requirements for forest categories either');
  assert.match(await hint.innerText(),/не сверены/i);
  console.log('V60_BROWSER_KU31_OK: Road category has no false M31/M1 mandatory chips, visible source status and full maket navigation.');
 }finally{await browser?.close();await new Promise(done=>server.close(done));}
})().catch(e=>{console.error(e);process.exitCode=1;});
