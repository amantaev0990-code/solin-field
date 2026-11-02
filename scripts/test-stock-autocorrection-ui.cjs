/* Real-browser stock correction regression against K59_1 and Макет10ЗАП fixtures. */
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=Number(process.env.TEST_PORT||8137);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]||'/'));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('forbidden');}
 try{const target=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
  res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');res.end(fs.readFileSync(target));
 }catch{res.writeHead(404);res.end('missing');}
});
let browser;
const field=(p,scope,name)=>p.locator('#ce-form [data-ce-scope="'+scope+'"][data-ce-field="'+name+'"]').first();
const val=async(p,scope,name)=>Number((await field(p,scope,name).inputValue()).replace(',','.'));
async function boot(p){
 await p.goto('http://127.0.0.1:'+port+'/');
 await p.waitForFunction(()=>window.SolinWorkspace&&window.SOLIN_REFS&&window.SolinCardEditor);
 await p.evaluate(()=>SolinWorkspace.ready);
}
async function fixture(p){
 const info=await p.evaluate(async()=>{
  const forest=(await SolinWorkspace.list())[0];if(!forest)throw Error('Bundled test forest not found');
  await SolinWorkspace.activate(forest.id);
  const rows=Object.values(D.quarters).flatMap(q=>q.compartments);
  const r=rows.find(x=>x._children?.Макет10?.length===1&&Number(x.KU)<11&&Number(x.PLV)>0);
  if(!r)throw Error('Single-row stand not found for browser fixture');
  const org=D.lesnichestvo.find(x=>String(x.POS)===String(r.POS)&&String(x.LESN)===String(r.LESN));
  if(!org)throw Error('KTO owner record not found');
  // Reproduce forests created by the previous three-select flow: missing KTO.
  delete org.KTO;
  if(!window.SOLIN_FOREST_CATALOG?.rows?.some(x=>x[0]===213&&x[1]===2&&x[4]===150000000))throw Error('Original owner catalogue is unavailable');
  Object.assign(r,{KU:2,PLV:2,M3Pr:'В',M3B:'3',KlxrVD:8,GodT1:2015,STUR1:99,STUR:198});
  r._children.Макет10=[{...r._children.Макет10[0],POS:r.POS,LESN:r.LESN,KV:r.KV,KGLF:r.KGLF,VD:r.VD,
   IAR:1,POR:'В',KOEF:10,PH:6,POL:0.6,LET:5,PROI:7,ZAP:99}];
  const refs=window.SOLIN_REFS.tables;
  const real=refs.Szap?.find(x=>Number(x.Obl)===150000000&&x.p1==='В'&&Number(x.LXZ)===8&&x.KUL==='.');
  if(!real||Number(real.v6)!==59)throw Error('Expected original Solim.mdb Szap v6=59 not found');
  const estimate=SolinCardCalculations.stockPerHectare(r,refs,org);
  if(estimate.status!=='complete'||estimate.expected!==35)throw Error('K59 did not recover real forest KTO: '+JSON.stringify(estimate));
  const bad={...r,KlxrVD:null};
  const missing=SolinCardCalculations.stockPerHectare(bad,refs,org);
  if(missing.status!=='waiting'||!missing.reason.includes('KlxrVD')||missing.reason.includes('KTO ('))throw Error('Missing input diagnostics are not specific: '+JSON.stringify(missing));
  current=r;renderComp();show('card');
  return {forestId:forest.id,address:{POS:r.POS,LESN:r.LESN,KV:r.KV,KGLF:r.KGLF,VD:r.VD},
   norms:{height7:SolinCardCalculations.k59Round(Number(real.v7)*0.6),
    half:SolinCardCalculations.k59Round(Number(real.v7)*0.5)}};
 });
 await p.locator('#wfEditBase').click();await p.locator('#ce-form').waitFor();
 return info;
}
async function reopen(p,info){
 await p.reload();await p.waitForFunction(()=>window.SolinWorkspace&&window.SOLIN_REFS);
 await p.evaluate(()=>SolinWorkspace.ready);
 await p.evaluate(async({forestId,address})=>{
  await SolinWorkspace.activate(forestId);
  current=Object.values(D.quarters).flatMap(q=>q.compartments)
   .find(r=>['POS','LESN','KV','KGLF','VD'].every(k=>String(r[k])===String(address[k])));
  if(!current)throw Error('Edited stand missing after reopening');
  renderComp();show('card');
 },info);
 await p.locator('#wfEditBase').click();await p.locator('#ce-form').waitFor();
}
(async()=>{try{
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':'chrome'),headless:true});
 const desktop=await browser.newContext({viewport:{width:1365,height:940}});
 const p=await desktop.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await boot(p);const info=await fixture(p);
 const zap=field(p,'Макет10','ZAP');
 await zap.fill('5');await zap.press('0');
 assert.equal(await zap.inputValue(),'50','Do not replace half-typed number');
 assert.equal(await val(p,'base','STUR1'),99,'Derived values wait for commit');
 await zap.press('Tab');
 assert.equal(await val(p,'Макет10','ZAP'),35,'K59 must automatically correct ZAP on exit');
 assert.equal(await val(p,'base','STUR1'),35);
 assert.equal(await val(p,'base','STUR'),70);
 assert.match(await p.locator('#ce-calc-notice').innerText(),/50.*35/s);
 console.log('PASS desktop typing, blur, K59 auto-correct and before/after');
 for(const typed of [30,40,50]){
  await zap.fill(String(typed));await zap.press('Tab');
  assert.equal(await val(p,'Макет10','ZAP'),35,'Typed '+typed+' must be corrected to the same original normative value');
  assert.match(await p.locator('#ce-calc-notice').innerText(),new RegExp(typed+'.*35','s'),
   'Correction notice must show the latest wrong '+typed+' and verified 35');
 }
 console.log('PASS original Szap correction for repeated 30 → 40 → 50 inputs');
 await field(p,'Макет10','PH').fill('7');
 await field(p,'Макет10','PH').press('Tab');
 assert.equal(await val(p,'Макет10','ZAP'),info.norms.height7);
 assert.equal(await val(p,'base','STUR'),info.norms.height7*2);
 await field(p,'Макет10','POL').fill('0,5');
 await field(p,'Макет10','POL').press('Tab');
 assert.equal(await val(p,'Макет10','ZAP'),info.norms.half);
 assert.equal(await val(p,'base','STUR'),info.norms.half*2);
 await field(p,'base','PLV').fill('3');
 await field(p,'base','PLV').press('Tab');
 assert.equal(await val(p,'base','STUR1'),info.norms.half);
 assert.equal(await val(p,'base','STUR'),info.norms.half*3);
 console.log('PASS height, fullness and area recompute ZAP/STUR in original order');
 await p.locator('#ce-save').click();await p.waitForFunction(()=>!document.querySelector('#ce-form'));
 assert.equal(Number(await p.evaluate(()=>current._children.Макет10[0].ZAP)),info.norms.half);
 await reopen(p,info);
 assert.equal(await val(p,'Макет10','ZAP'),info.norms.half);
 assert.equal(await val(p,'base','STUR'),info.norms.half*3);
 console.log('PASS save + reload persisted corrected stock');
 await p.locator('#ce-cancel').click();
 await p.evaluate(()=>{
  const base=current._children.Макет10[0];
  current._children.Макет10.push({...base,ZAP:10});
  current.STUR=0;current.STUR1=0;solinWorkflow.exitCard();
 });
 assert.equal(await p.evaluate(()=>current.STUR1),info.norms.half+10);
 assert.equal(await p.evaluate(()=>current.STUR),(info.norms.half+10)*3);
 console.log('PASS alternate exit aggregates Maket10 ZAP and recalculates STUR');
 // Deliberately make the normative source unavailable. The entered ZAP must
 // never be presented as independently verified merely because STUR follows it.
 await p.evaluate(()=>{
   window.SOLIN_REFS.tables.Szap=[];
   show('card');renderComp();
 });
 await p.locator('#wfEditBase').click();await p.locator('#ce-form').waitFor();
 const unverified=field(p,'Макет10','ZAP');
 for(const typed of [30,40,50]){
  await unverified.fill(String(typed));await unverified.press('Tab');
  assert.equal(await val(p,'Макет10','ZAP'),typed,'No K59 norm: preserve typed ZAP');
  assert.match(await p.locator('#ce-calc-notice').innerText(),/не проверен по К59/i);
  assert.match(await p.locator('#ce-calc-notice').innerText(),/не доказывает|не признано правильным/i);
 }
 console.log('PASS 30 → 40 → 50 without normative source: not falsely confirmed');
 await p.locator('#ce-save').click();await p.waitForFunction(()=>!document.querySelector('#ce-form'));
 await p.evaluate(()=>{show('card');renderComp();solinWorkflow.editMaket('Макет10',0)});
 await p.locator('#wf_ZAP').fill('40');await p.locator('#wfSaveMaket').click();
 assert.match(await p.locator('#modalBody').innerText(),/не подтверждён по К59/i);
 assert.match(await p.locator('#modalBody').innerText(),/арифметический пересчёт, а не исправление запаса/i);
 assert.doesNotMatch(await p.locator('#modalBody').innerText(),/Обнаружены неверные исходные значения/i);
 console.log('PASS alternate Maket10 editor: no false original correction');
 // Test the actual 3-select forest creation path and recovery of a saved
 // pre-fix forest which had no KTO. Never touch the user's own device.
 const repair=await p.evaluate(async()=>{
  const selected=window.SOLIN_FOREST_CATALOG.rows.find(x=>x[0]===213&&x[1]===1);
  if(!selected||selected[4]!==150000000)throw Error('Missing original 213/1 registry KTO');
  const forest=await SolinWorkspace.create({regionCode:200,ownerCode:213,districtCode:1});
  if(D.lesnichestvo[0].KTO!==selected[4])throw Error('New forest did not carry catalog KTO');
  delete D.lesnichestvo[0].KTO;
  await SolinWorkspace.persist();
  await SolinWorkspace.activate(forest.id);
  const code=D.lesnichestvo[0].KTO;
  const saved=(await SolinWorkspace.list()).find(x=>x.id===forest.id)?.org?.KTO;
  if(code!==selected[4]||saved!==selected[4])throw Error('Old forest KTO repair failed');
  return {code,saved};
 });
 assert.equal(repair.code,150000000);
 console.log('PASS new 3-select forest KTO and existing saved forest KTO repair');
 // Reproduce the user's address 723/4/1/1 with standard New quarter/New stand
 // screens. "8" is a test-selected quarter zone, NOT a guessed 723 norm.
 const forestCodes=await p.evaluate(async()=>{
  const forest=await SolinWorkspace.create({regionCode:700,ownerCode:723,districtCode:4});
  if(Number(D.lesnichestvo?.[0]?.KTO)!==350000000)throw Error('Original 723/4 KTO was lost');
  openQuarterForm();
  document.querySelector('#newKV').value='1';
  document.querySelector('#newKGLF').value='1';
  document.querySelector('#newKpz').value='2';
  document.querySelector('#newKlxr').value='8';
  createQuarter();
  if(Number(D.quarters['1']?.meta?.GodT)!==Number(D.lesnichestvo[0].GodT))throw Error('Quarter year not inherited');
  openCompForm('1');
  document.querySelector('#newVD').value='1';
  document.querySelector('#newPLV').value='1';
  document.querySelector('#newKU').value='2';
  document.querySelector('#newPOR').value='В';
  createComp();
  let r=D.quarters['1'].compartments[0];
  if(!r||Number(r.KlxrVD)!==8||Number(r.KGLF)!==1||Number(r.POS)!==723||Number(r.LESN)!==4)
   throw Error('New stand lost quarter/forest inherited address '+JSON.stringify(r));
  r._children.Макет10=[{IAR:1,POR:'В',ZAP:40}];
  delete r.KlxrVD;await SolinWorkspace.persist();
  await SolinWorkspace.activate(forest.id);
  r=D.quarters['1'].compartments[0];
  if(Number(r.KlxrVD)!==8||Number(r._children.Макет10[0].POS)!==723)
   throw Error('Existing 723/4/1/1 code restore failed');
  const stored=(await SolinWorkspace.list()).find(f=>f.id===forest.id);
  if(Number(stored?.quarters?.['1']?.compartments?.[0]?.KlxrVD)!==8)
   throw Error('Inherited stand zone was not persisted to IndexedDB');
  r.KlxrVD=9;await SolinWorkspace.persist();await SolinWorkspace.activate(forest.id);
  if(Number(D.quarters['1'].compartments[0].KlxrVD)!==9)
   throw Error('Explicit zone was silently overwritten');
  const multi={quarterRows:[{POS:723,LESN:4,KV:1,KGLF:1,Klxr:7},{POS:723,LESN:4,KV:1,KGLF:1,Klxr:8}]};
  if(window.SolinAddressContext.resolveQuarter({POS:723,LESN:4,KV:1,KGLF:1,VD:1},multi)!==null)
   throw Error('Ambiguous quarter rows must not be guessed');
  return {KTO:D.lesnichestvo[0].KTO,zone:stored.quarters['1'].compartments[0].KlxrVD};
 });
 assert.equal(forestCodes.KTO,350000000);
 assert.equal(Number(forestCodes.zone),8);
 console.log('PASS real 723/4/1/1 UI create: KTO, quarter year, KlxrVD, children, old-record repair and ambiguity');
 // The preceding unavailable-source case intentionally cleared Szap in memory.
 // Reload the actual reference data before auditing the real Karaganda table.
 await boot(p);
 await p.evaluate(()=>SolinWorkspace.activate('723::4'));
 // Screenshot regression: original Szap has NO Obl=350000000/LXZ=8,
 // despite this zone being listed for Kpz 2 in the general Slxr catalog.
 await p.evaluate(()=>{
  const q=D.quarters['1'],r=q.compartments[0];
  q.meta.Kpz=2;q.meta.Klxr=8;r.KlxrVD=8;r.M3Pr='В';r.M3B='3';r.KU=2;r.PLV=1;
  r.STUR1=154;r.STUR=154;r.GodT1=2015;
  r._children.Макет10=[{POS:723,LESN:4,KV:1,KGLF:1,VD:1,IAR:1,KOEF:10,POR:'В',PH:6,POL:0.6,LET:5,PROI:7,ZAP:154}];
  current=r;renderComp();show('card');solinWorkflow.editMaket('Макет10',0);
 });
 await p.locator('#wf_ZAP').fill('170');await p.locator('#wfSaveMaket').click();
 const screenshotWarning=await p.locator('#modalBody').innerText();
 assert.match(screenshotWarning,/LXZ 8/);
 assert.match(screenshotWarning,/350000000/);
 assert.match(screenshotWarning,/3.*4.*7/s);
 assert.match(screenshotWarning,/не подтверждён по К59/i);
 assert.equal(await p.evaluate(()=>current._children.Макет10[0].ZAP),170);
 assert.equal(await p.evaluate(()=>current.STUR1),170);
 await p.locator('#wf-k59-open-quarter').click();
 await p.waitForFunction(()=>document.querySelector('#quartersScreen')?.classList.contains('active'));
 const quarterZoneHint=await p.evaluate(()=>{window.openQuarter('1');return !!document.querySelector('#wfQuarterToolbar')});
 console.log('PASS real screenshot 723/4/1/1: LXZ8 rejected, Szap+Slxr zone 3/4/7 explained, quarter navigation works');
 await desktop.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.message));
 await boot(m);const mobileInfo=await fixture(m);
 await m.locator('[data-ce-assist-row]').click();
 const idx=await m.locator('#ce-table-Макет10 tbody tr').first().locator('[data-ce-field]').evaluateAll(xs=>xs.findIndex(x=>x.dataset.ceField==='ZAP'));
 assert(idx>=0);
 await m.locator('[data-ce-assist-row-field="'+idx+'"]').click();
 await m.locator('#ce-assist-value').fill('83');
 await m.locator('[data-ce-assist-apply]').click();
 assert.equal(await val(m,'Макет10','ZAP'),35);
 assert.equal(await val(m,'base','STUR'),70);
 assert.match(await m.locator('#ce-calc-notice').innerText(),/83.*35/s);
 await m.locator('[data-ce-assist-done]').click();
 await m.locator('#ce-save').click();await m.waitForFunction(()=>!document.querySelector('#ce-form'));
 await reopen(m,mobileInfo);
 assert.equal(await val(m,'Макет10','ZAP'),35);
 assert.equal(await val(m,'base','STUR'),70);
 console.log('PASS mobile quick entry, automatic correction, Save and reopen');
 assert.deepEqual(errors,[]);console.log('STOCK_AUTO_CORRECTION_UI_OK');
 await mobile.close();
}catch(e){console.error(e.stack||e);process.exitCode=1;}finally{await browser?.close();server.close();}})();
