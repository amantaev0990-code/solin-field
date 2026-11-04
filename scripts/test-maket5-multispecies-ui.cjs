/* Exact 6ОС + 4Б entry, real source norms, live calculation and persistence. */
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),port=8188;
const server=http.createServer((req,res)=>{try{
 const p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(p!==root&&!p.startsWith(root+path.sep))throw Error('Path');
 const f=fs.statSync(p).isDirectory()?path.join(p,'index.html'):p;
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
}catch{res.writeHead(404);res.end();}});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(port,'127.0.0.1',r));browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1390,height:990}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port+'/');await page.waitForFunction(()=>window.SolinWorkspace&&window.SolinCardEditor&&window.SOLIN_REFS);await page.evaluate(()=>SolinWorkspace.ready);
 const fixture=await page.evaluate(async()=>{
  const f=(await SolinWorkspace.list())[0];await SolinWorkspace.activate(f.id);D.lesnichestvo[0].KTO=150000000;
  const r=Object.values(D.quarters).flatMap(q=>q.compartments||[]).find(r=>Number(r.PLV)>0);
  const quarter=SolinAddressContext.resolveQuarter(r,D.quarters[String(r.KV)]);if(quarter)quarter.GodT=2015;
  Object.assign(r,{KU:2,PLV:2,M3Pr:'ОС',KlxrVD:8,GodT1:2015,STUR1:0,STUR:0,M4SS:7});
  const addr=Object.fromEntries(['POS','LESN','KV','KGLF','VD'].map(k=>[k,r[k]]));
  r._children={...r._children,Макет10:[
   {...addr,IAR:1,POR:'ОС',KOEF:6,PH:20,POL:.6,LET:40,PROI:7,ZAP:null},
   {...addr,IAR:1,POR:'Б',KOEF:4,PH:null,POL:null,LET:40,PROI:7,ZAP:null},
   {...addr,IAR:2,POR:'Б',KOEF:10,PH:10,POL:.4,LET:20,PROI:7,ZAP:null},
   {...addr,IAR:7,POR:'ОС',ZAP:4},{...addr,IAR:8,POR:'Б',ZAP:12}]};
  current=r;renderComp();show('card');SolinCardEditor.open(r);
  const t=SOLIN_REFS.tables.Szap.find(x=>x.Obl===150000000&&x.LXZ===8&&x.KUL==='.'&&x.p1==='ОС');
  const b=SOLIN_REFS.tables.Szap.find(x=>x.Obl===150000000&&x.LXZ===8&&x.KUL==='.'&&x.p1==='Б');
  return {id:f.id,kv:r.KV,vd:r.VD,first:Math.floor(t.v19*.6+.5),changed:Math.floor(t.v21*.6+.5),second:Math.floor(b.v10*.4+.5)};
 });
 const cell=(field,row)=>page.locator('#ce-form [data-ce-scope="Макет10"][data-ce-field="'+field+'"][data-ce-row="'+row+'"]');
 const value=field=>page.locator('#ce-form [data-ce-scope="base"][data-ce-field="'+field+'"]');
 const waitTotal=total=>page.waitForFunction(total=>Number(document.querySelector('#ce-stock-live').textContent)===total,total);
 assert(await value('STUR1').isVisible(),'Maket5 stock per hectare must be visible');
 await cell('PH',1).fill('18');const total=fixture.first+fixture.second;await waitTotal(total);
 assert.equal(Number(await cell('ZAP',0).inputValue()),fixture.first,'Weighted height (6*20+4*18)/10=19.2 -> v19*0.6');
 assert.equal(await cell('ZAP',1).inputValue(),'','Preserve companion NULL until an original update rule is proven');
 assert.equal(Number(await cell('ZAP',2).inputValue()),fixture.second);assert.equal(Number(await value('STUR').inputValue()),0,'Original scalar UPDATE equivalence is not proven for these tiers');
 assert.match(await page.locator('#ce-stock-live').innerText(),new RegExp('^'+total+'$'));
 assert.match(await page.locator('#ce-stock-fresh').innerText(),/^12$/);assert.match(await page.locator('#ce-stock-drywood').innerText(),/^7$/);
 assert.equal(await page.evaluate(()=>current.STUR1),0,'Editing remains a draft');
 // Input error must be rejected before it ever reaches persisted Maket10.
 await cell('ZAP',1).fill('3120');
 await cell('ZAP',1).press('Tab');
 await page.waitForFunction(()=>document.querySelector('#ce-stock-audit')?.dataset.stockStatus==='ambiguous');
 assert.equal(await cell('ZAP',1).inputValue(),'3120','Unverified input must remain visible for review');
 await cell('ZAP',1).fill('');
 await cell('PH',1).fill('22');const updated=fixture.changed+fixture.second;await waitTotal(updated);
 await cell('KOEF',1).fill('3');await page.waitForFunction(()=>document.querySelector('#ce-stock-audit')?.dataset.stockStatus==='waiting');
 assert.equal(await page.locator('#ce-stock-audit').getAttribute('data-stock-status'),'waiting','Incomplete 6+3 is unverified and must retain existing totals');
 await cell('KOEF',1).fill('4');await cell('KOEF',1).press('Tab');await waitTotal(updated);
 await page.locator('#ce-save').click();await page.waitForFunction(()=>!document.querySelector('#ce-form'));assert.equal(await page.evaluate(()=>current.STUR1),0);
 await page.reload();await page.waitForFunction(()=>window.SolinWorkspace&&window.SolinCardEditor&&window.SOLIN_REFS);await page.evaluate(()=>SolinWorkspace.ready);
 const saved=await page.evaluate(async f=>{await SolinWorkspace.activate(f.id);const r=Object.values(D.quarters).flatMap(q=>q.compartments||[]).find(r=>String(r.KV)===String(f.kv)&&String(r.VD)===String(f.vd));return {perHa:r.STUR1,total:r.STUR,zap:r._children.Макет10[0].ZAP,companion:r._children.Макет10[1].ZAP};},fixture);
 assert.equal(saved.perHa,0);assert.equal(saved.total,0);assert.equal(saved.zap,fixture.changed);assert.equal(saved.companion,null);assert.deepEqual(errors,[]);
 console.log('MAKET5_MIXED_AUTOCALC_OK: 6ОС+4Б, live entry, companion height affects norm, independent second tier, incomplete composition preserves unverified totals, deadwood separate, save/reload');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
