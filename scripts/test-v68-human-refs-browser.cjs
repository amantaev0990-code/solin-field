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
  if(!file.startsWith(root+path.sep))throw Error('Bad asset path');
  const data=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(data);
 }catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch();
  const page=await browser.newPage({...devices['Pixel 7'],viewport:{width:1067,height:667}});
  await page.route(url=>url.hostname!=='127.0.0.1',route=>route.abort());
  await page.addInitScript(()=>window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',Plugins:{}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>await window.SolinWorkspace.ready);
  await page.waitForFunction(()=>!!window.SOLIN_REFS?.tables?.SDP?.length,null,{timeout:25000});
  await page.locator('#mainScreen [data-field-route="refsScreen"]').click();
  await page.waitForFunction(()=>!!document.querySelector('#refsScreen.active'),null,{timeout:6000});
  await page.waitForFunction(()=>document.querySelectorAll('#friendlyRefs details.refCard').length>2,null,{timeout:10000});
  const result=await page.evaluate(()=>({
   human:!!document.querySelector('#friendlyRefs .human-ref-row'),
   summaries:[...document.querySelectorAll('#friendlyRefs details.refCard summary')].map(x=>x.textContent),
   codes:[...document.querySelectorAll('#friendlyRefs details.refCard')].map(x=>x.dataset.reference),
   escapedRaw:document.querySelector('#friendlyRefs')?.textContent?.includes('153 исходные таблицы S*')
  }));
  assert.ok(result.codes.includes('SDP'),'Species directory must be included');
  assert.ok(result.codes.includes('SKU'),'Land categories directory must be included');
  assert.ok(result.summaries.some(x=>x.includes('Древесные и кустарниковые породы')),
   'General directory titles must use Russian names');
  assert.equal(result.escapedRaw,false,'Raw audit data view must NOT replace the friendly directory');
  const species=page.locator('#friendlyRefs details[data-reference="SDP"]');
  await species.locator('summary').click();
  await species.locator('.human-ref-row').first().waitFor({state:'attached',timeout:10000});
  const human=await species.locator('.human-ref-row').first().innerText();
  assert.match(human,/Шифр\s*\S+/,'A clear original code must appear alongside Russian description');
  assert.ok(!human.includes('NDP:'),'Ordinary user should not see raw column identifiers instead of names');
  // Confirm search uses Russian name or source code, not just technical table names.
  const search=page.locator('#refsScreen input');
  await search.fill('Осина');
  assert.ok(await page.locator('#friendlyRefs details[data-reference="SDP"]').count(),
    'Search by the Russian species name must show relevant dictionary');
  await page.locator('#homeButton').click();
  await page.waitForFunction(()=>!!document.querySelector('#mainScreen.active'),null,{timeout:5000});
  await page.locator('#mainScreen [data-field-route="calculationRefs"]').click();
  await page.waitForFunction(()=>!!document.querySelector('#calculationRefs.active'),null,{timeout:5000});
  assert.equal(await page.locator('#refsScreen.active').count(),0,
    'Calculation references stay independent of the general directory');
  console.log('V68 PASS: original Russian names + source codes; search by names; separate calculation references.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
