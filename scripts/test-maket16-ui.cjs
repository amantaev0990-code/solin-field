'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(f!==root&&!f.startsWith(root+path.sep))throw Error('path');if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.wasm':'application/wasm','.css':'text/css'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404);res.end();}});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({...(process.env.BROWSER_CHANNEL==='bundled'?{}:{channel:process.env.BROWSER_CHANNEL||'chrome'}),headless:true});
 for(const prefix of ['/','/www/']){
  const context=await browser.newContext({viewport:{width:430,height:932}}),page=await context.newPage();page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:'+server.address().port+prefix);await page.waitForFunction(()=>window.SolinWorkspace&&window.SolinMaket16&&window.SOLIN_REFS?.tables?.S16VOZ);await page.evaluate(()=>SolinWorkspace.ready);
  await page.evaluate(async()=>{
   const list=await SolinWorkspace.list();await SolinWorkspace.activate(list[0].id);const q=D.quarters[Object.keys(D.quarters).find(k=>D.quarters[k].compartments?.length)],r=JSON.parse(JSON.stringify(q.compartments[0]));
   const quarter=SolinAddressContext.resolveQuarter(r,q);quarter.Klxr=17;Object.assign(r,{KU:1,M3Pr:'К',M3TLU:'КЕР',KlxrVD:17});
   const addr=Object.fromEntries(['POS','LESN','KV','KGLF','VD'].map(k=>[k,r[k]]));r._children={Макет10:[{...addr,IAR:1,POR:'К',KOEF:1,LET:202,PH:20,POL:.3,ZAP:40,PROI:7}],Макет16:[{...addr,Por16:'К',Koef16:9,Voz16:180,H16:'КЕР  ',Ediz:.30000001192092896,Ur16:123.1234567890123,Neds:5,Sbor:3,_custom:'keep'}]};
   q.compartments[0]=r;current=r;window.__m16record=r;SolinCardEditor.open(r,{focus:{form:'Макет16',field:'H16'}});
  });
  assert.equal(await page.locator('[data-ce-scope="Макет16"][data-ce-field="H16"]').inputValue(),'КЕР  ');
  await page.click('#ce-exit');await page.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));
  const saved=await page.evaluate(()=>__m16record._children.Макет16[0]);assert.equal(saved.H16,'КЕР  ');assert.equal(saved.Ediz,.30000001192092896);assert.equal(saved.Ur16,123.1234567890123);assert.equal(saved._custom,'keep');
  await page.evaluate(()=>SolinCardEditor.open(__m16record,{focus:{form:'Макет16',field:'H16'}}));await page.click('[data-ce-m16="parameters"]');await page.click('[data-ce-m16-apply]');
  assert.equal(await page.locator('[data-ce-scope="Макет16"][data-ce-field="H16"]').inputValue(),'КЕР');assert.equal((await page.evaluate(()=>__m16record._children.Макет16[0])).H16,'КЕР  ','Preview/application must remain a draft');
  await page.click('#ce-exit');await page.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));
  const updated=await page.evaluate(()=>__m16record._children.Макет16[0]);assert.equal(updated.Koef16,1);assert.equal(updated.Voz16,202);assert.equal(updated.Ur16,saved.Ur16);assert.equal(updated.Neds,5);assert.equal(updated.Sbor,3);assert.equal(updated._custom,'keep');
  await page.evaluate(()=>SolinCardEditor.open(__m16record,{focus:{form:'Макет16'}}));await page.click('[data-ce-m16="create"]');assert.equal(await page.locator('[data-ce-m16-apply]').count(),0,'Existing rows must not be replaced');await page.click('#ce-cancel');
  await page.evaluate(()=>{__m16record._children.Макет16=[];SolinCardEditor.open(__m16record,{focus:{form:'Макет16'}});});await context.setOffline(true);
  await page.click('[data-ce-m16="create"]');await page.click('[data-ce-m16-apply]');assert.equal(await page.locator('[data-ce-scope="Макет16"][data-ce-field="Ur16"]').inputValue(),'162');assert.equal(await page.evaluate(()=>__m16record._children.Макет16.length),0);
  await page.click('#ce-exit');await page.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));const made=await page.evaluate(()=>__m16record._children.Макет16[0]);assert.equal(made.Ur16,162);assert.equal(made.H16,'КЕР');assert.equal(made.Ediz,Math.fround(.3));assert.equal(made.Neds,1);assert.equal(made.Sbor,1);
  await context.close();
 }
 console.log('MAKET16_UI_OK public/native staged assets: exact untouched text/Double, five-field preview/save, preserved yield, duplicate guard and offline creation');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
