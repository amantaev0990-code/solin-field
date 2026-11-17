'use strict';
// Regression: the two main-menu directory buttons must open distinct screens
// and show their own data. Run against extracted APK assets: node ... www
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
  const data=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(data);
 }catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch();
  const context=await browser.newContext({...devices['Pixel 7'],viewport:{width:1067,height:667}});
  const page=await context.newPage();
  await page.route(u=>u.hostname!=='127.0.0.1',route=>route.abort());
  // Test extracted Android assets in native mode: the bundled original
  // directory is refs-audit.packed.bin, not the optional browser JSON.
  await page.addInitScript(()=>window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',Plugins:{}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>await window.SolinWorkspace.ready);
  assert.ok(await page.locator('#mainScreen [data-field-route="refsScreen"]').count());
  assert.ok(await page.locator('#mainScreen [data-field-route="calculationRefs"]').count());
  assert.equal(await page.locator('#calculationRefs').count(),1,'Separate calculation screen must exist');
  await page.locator('#mainScreen [data-field-route="refsScreen"]').click();
  await page.waitForFunction(()=>document.querySelector('#refsScreen.active'));
  assert.equal(await page.locator('#calculationRefs.active').count(),0);
  assert.ok(await page.locator('#friendlyRefs').count(),'General reference list must be intact');
  await page.locator('#homeButton').click();
  await page.waitForFunction(()=>document.querySelector('#mainScreen.active'));
  await page.locator('#mainScreen [data-field-route="calculationRefs"]').click();
  await page.waitForFunction(()=>document.querySelector('#calculationRefs.active'));
  assert.equal(await page.locator('#refsScreen.active').count(),0,
    'Calculation reference click must not redirect to general references');
  await page.waitForFunction(()=>document.querySelector('#calcRefsStatus')?.textContent?.includes('Расчётных таблиц:'),null,{timeout:20000});
  const codeNames=await page.locator('#calcRefsList details.refCard summary').allInnerTexts();
  assert.ok(codeNames.some(name=>name.includes('SSHB')),'K58 bonitet norm must be listed');
  assert.ok(codeNames.some(name=>name.includes('Szap')),'K59 stock norm must be listed');
  await page.locator('#calcRefsList details.refCard').first().locator('summary').click();
  await page.locator('#calcRefsList details.refCard').first().locator('.wf-check').first().waitFor({state:'attached',timeout:5000});
  await page.locator('#calcRefsSearch').fill('НесуществующийКод987654');
  assert.match(await page.locator('#calcRefsStatus').innerText(),/Совпадений не найдено/);
  await page.locator('#calcRefsSearch').fill('');
  await page.locator('#homeButton').click();
  await page.waitForFunction(()=>document.querySelector('#mainScreen.active'));
  await page.locator('#mainScreen [data-field-route="refsScreen"]').click();
  await page.waitForFunction(()=>document.querySelector('#refsScreen.active'));
  assert.ok(await page.locator('#friendlyRefs').count(),'Return to ordinary references must still work');
  await context.close();
  console.log('V66 PASS: distinct buttons/screens, source-backed calculation tables and ordinary references intact.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
