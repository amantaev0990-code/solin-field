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
 assert.equal(await p.evaluate(()=>current.STUR1),0);
 assert.equal(await p.evaluate(()=>current.STUR),0);
 console.log('PASS alternate exit rejects duplicate ZAP instead of double-counting the layer');
 const preservedHistorical=await p.evaluate(()=>{
   const record=current,before1=record.STUR1,before=record.STUR;
   record.STUR1=777;record.STUR=888;
   solinWorkflow.exitCard();
   const result={perHa:record.STUR1,total:record.STUR};
   record.STUR1=before1;record.STUR=before;
   return result;
 });
 assert.deepEqual(preservedHistorical,{perHa:777,total:888},
  'Exiting a card must not silently overwrite existing historical Access stock totals');
 console.log('PASS historical stock preserved on exit unless original totals were empty');
 // Remove the deliberately invalid duplicate row before testing lack of
 // Szap. The two cases must not affect each other's warning expectations.
 await p.evaluate(()=>{current._children.Макет10=current._children.Макет10.slice(0,1);});
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
 // Earlier case intentionally removed Szap; reload the actual sources before
 // testing regional dropdown filters, otherwise no normative values exist.
 await boot(p);
 // Reproduce the user's address 723/4/1/1 with standard New quarter/New stand
 // screens. "8" is a test-selected quarter zone, NOT a guessed 723 norm.
 const forestCodes=await p.evaluate(async()=>{
  const forest=await SolinWorkspace.create({regionCode:700,ownerCode:723,districtCode:4});
  if(Number(D.lesnichestvo?.[0]?.KTO)!==350000000)throw Error('Original 723/4 KTO was lost');
  openQuarterForm();
  document.querySelector('#newKV').value='1';
  const glf=document.querySelector('#newKGLF');
  const glfCode=glf.tagName==='SELECT'?[...glf.options].find(x=>x.value&&!x.disabled)?.value:'1';
  if(!glfCode)throw Error('No original Sples.PR>0 forest category for new quarter');
  glf.value=glfCode;
  document.querySelector('#newKpz').value='2';
  document.querySelector('#newKpz').dispatchEvent(new Event('input',{bubbles:true}));
  const allowed=[...document.querySelector('#newKlxr').options].filter(x=>x.value).map(x=>Number(x.value));
  if(allowed.join(',')!=='3,4,7')throw Error('New quarter shows incorrect normative zone codes: '+allowed);
  document.querySelector('#newKlxr').value='4';
  createQuarter();
  if(Number(D.quarters['1']?.meta?.GodT)!==Number(D.lesnichestvo[0].GodT))throw Error('Quarter year not inherited');
  openCompForm('1');
  document.querySelector('#newVD').value='1';
  document.querySelector('#newPLV').value='1';
  document.querySelector('#newKU').value='2';
  document.querySelector('#newPOR').value='В';
  createComp();
  let r=D.quarters['1'].compartments[0];
  if(!r||Number(r.KlxrVD)!==4||String(r.KGLF)!==String(D.quarters['1'].meta.KGLF)||Number(r.POS)!==723||Number(r.LESN)!==4)
   throw Error('New stand lost quarter/forest inherited address '+JSON.stringify(r));
  r._children.Макет10=[{IAR:1,POR:'В',ZAP:40}];
  delete r.KlxrVD;await SolinWorkspace.persist();
  await SolinWorkspace.activate(forest.id);
  r=D.quarters['1'].compartments[0];
  if(Number(r.KlxrVD)!==4||Number(r._children.Макет10[0].POS)!==723)
   throw Error('Existing 723/4/1/1 code restore failed');
  const stored=(await SolinWorkspace.list()).find(f=>f.id===forest.id);
  if(Number(stored?.quarters?.['1']?.compartments?.[0]?.KlxrVD)!==4)
   throw Error('Inherited stand zone was not persisted to IndexedDB');
  r.KlxrVD=9;await SolinWorkspace.persist();await SolinWorkspace.activate(forest.id);
  if(Number(D.quarters['1'].compartments[0].KlxrVD)!==9)
   throw Error('Explicit zone was silently overwritten');
  const multi={quarterRows:[{POS:723,LESN:4,KV:1,KGLF:r.KGLF,Klxr:7},{POS:723,LESN:4,KV:1,KGLF:r.KGLF,Klxr:8}]};
  if(window.SolinAddressContext.resolveQuarter({POS:723,LESN:4,KV:1,KGLF:r.KGLF,VD:1},multi)!==null)
   throw Error('Ambiguous quarter rows must not be guessed');
  return {KTO:D.lesnichestvo[0].KTO,zone:stored.quarters['1'].compartments[0].KlxrVD};
 });
 assert.equal(forestCodes.KTO,350000000);
 assert.equal(Number(forestCodes.zone),4);
 console.log('PASS real 723/4/1/1 UI create: KTO, quarter year, KlxrVD, children, old-record repair and ambiguity');
 // Both address fields must use full independent, native selects.
 await p.evaluate(()=>openQuarterForm());
 const newQuarterContext=await p.evaluate(()=>{
  const functional=document.querySelector('#newFzona'),district=document.querySelector('#newRaion');
  const codes=[...functional.options].map(o=>o.value).filter(Boolean);
  const before=codes.join(',');
  const category=document.querySelector('#newKGLF');
  if([...category.options].some(x=>x.value==='27')){category.value='27';category.dispatchEvent(new Event('change',{bubbles:true}));}
  return {functional:functional.tagName,raion:district.tagName,
   codes,before,after:[...functional.options].map(o=>o.value).filter(Boolean).join(','),
   value:functional.value,districtCodes:[...district.options].map(o=>o.value),
   districtHint:document.querySelector('#newRaionHint')?.textContent};
 });
 assert.equal(newQuarterContext.functional,'SELECT');
 assert.equal(newQuarterContext.raion,'SELECT');
 assert.equal(newQuarterContext.value,'','Do not guess a default SFZ code');
 assert(newQuarterContext.codes.includes('0')&&!newQuarterContext.codes.includes('1'),
   'Without KGLF, do not offer unrelated functional zones');
  assert(!newQuarterContext.after.split(',').includes('1'),
   'Actual Sples KGLF=27 has no SFZ.KLF=27: do not offer unrelated zone 1');
 assert(newQuarterContext.districtCodes.includes('356400000'));
 assert.match(newQuarterContext.districtHint,/Кл_Рай/);
 await p.evaluate(()=>closeModal());
 console.log('PASS New Quarter linked Fzona/Raion lists with manual fallback');
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
  r._children.Макет10=[{POS:723,LESN:4,KV:1,KGLF:r.KGLF,VD:1,IAR:1,KOEF:10,POR:'В',PH:6,POL:0.6,LET:5,PROI:7,ZAP:154}];
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
 assert.match(await p.locator('#modalTitle').innerText(),/Корректировка квартала 1/);
 assert.equal(await p.locator('#modalBody [data-qfield="Klxr"]').inputValue(),'8');
 assert.match(await p.locator('#modalBody .wf-form-note').last().innerText(),/3, 4, 7/);
 const actualOptions=await p.locator('#modalBody [data-qfield="Klxr"] option').evaluateAll(xs=>xs.filter(x=>x.value&&!x.disabled).map(x=>x.value));
 assert.deepEqual(actualOptions,['3','4','7'],'Quarter edit must offer ONLY KTO/Kpz valid zones');
 const qZoneControl=p.locator('#modalBody [data-qfield="Klxr"]');
 if(await qZoneControl.evaluate(el=>el.tagName)==='SELECT')await qZoneControl.selectOption('4');
 else await qZoneControl.fill('4');
 await p.locator('#saveQuarter').click();
 await p.waitForFunction(()=>document.querySelector('#modal')?.classList.contains('hidden'));
 const zoneFixed=await p.evaluate(()=>{
  const q=D.quarters['1'],r=q.compartments[0];
  if(String(q.meta.Klxr)!=='4'||String(r.KlxrVD)!=='4')throw Error('Quarter Klxr did not cascade to actual 723/4 stand');
  const org=D.lesnichestvo[0];
  const norm=SolinCardCalculations.stockPerHectare(r,SOLIN_REFS.tables,org,q.meta);
  if(norm.status!=='complete')throw Error('Quarter correction did not unlock original K59: '+JSON.stringify(norm));
  current=r;renderComp();show('card');solinWorkflow.editMaket('Макет10',0);
  return norm.expected;
 });
 await p.locator('#wf_ZAP').fill('170');await p.locator('#wfSaveMaket').click();
 assert.equal(await p.evaluate(()=>current._children.Макет10[0].ZAP),zoneFixed,
  'After user chooses a supported quarter zone, original K59 must auto-correct ZAP');
 assert.match(await p.locator('#modalTitle').innerText(),/К59: нормативный запас автоматически исправлен/);
 console.log('PASS screenshot 723/4/1/1 end-to-end: LXZ8 unsupported -> quarter Klxr4 -> stand KlxrVD4 -> normative ZAP correction');
 // General dependency regression: individual Maket dialogs use the SAME
 // source-filtered engine, not just Maket10 IAR / quarter Klxr.
 await p.evaluate(()=>{
  closeModal();current._children.Макет16=[{Por16:'В'}];
  solinWorkflow.editMaket('Макет16',0);
 });
 assert.equal(await p.locator('#wf_Por16').evaluate(el=>el.tagName),'SELECT');
 const species16=await p.locator('#wf_Por16 option').evaluateAll(xs=>xs.filter(x=>x.value&&!x.disabled).map(x=>x.value));
 assert.deepEqual(species16,['В'],'Maket16 must offer only species present in this stand Maket10');
 console.log('PASS Maket16.Por16 choices follow this stand Maket10 species');
 // Editing a Maket10 species in the narrow standalone popup must not
 // silently orphan the linked Maket16 species. Full-card edit remains the
 // path for a simultaneous change of both original Access forms.
 await p.evaluate(()=>{closeModal();solinWorkflow.editMaket('Макет10',0)});
 const maket10Species=p.locator('#wf_POR');
 if(await maket10Species.evaluate(el=>el.tagName)==='SELECT'){
  const present=await maket10Species.evaluate(el=>[...el.options].some(o=>o.value==='Б'&&!o.disabled));
  if(present)await maket10Species.selectOption('Б');
  else await maket10Species.evaluate(el=>{el.add(new Option('Берёза','Б'));el.value='Б'});
 }else await maket10Species.fill('Б');
 await p.locator('#wfSaveMaket').click();
 assert.equal(await p.evaluate(()=>current._children.Макет10[0].POR),'В',
  'Standalone tree species change must be refused while Maket16 still refers to В');
 console.log('PASS standalone Maket10 Save cannot orphan Maket16 species');
 // The DELETE path must also preserve linked species, not just Edit/Save.
 await p.evaluate(()=>{closeModal();solinWorkflow.openMaket('Макет10')});
 await p.locator('#childContent [data-del="0"]').click();
 assert.equal(await p.evaluate(()=>current._children.Макет10.length),1,
  'Deleting final source Maket10 row must not orphan Maket16');
 console.log('PASS Maket10 Delete is blocked when Maket16 depends on the only species');
 await p.evaluate(()=>{
  closeModal();current._children.Макет12=[{KTP:84,SV:null}];
  solinWorkflow.editMaket('Макет12',0);
 });
 const damage=await p.evaluate(()=>{
  const expected=SolinDependentRules.options('Макет12','SV',{KTP:84},current,D.lesnichestvo[0]);
  const el=document.querySelector('#wf_SV');
  return {status:expected?.status,expected:expected?.items?.map(x=>x.value),
   tag:el?.tagName,actual:[...(el?.options||[])].filter(x=>x.value&&!x.disabled).map(x=>x.value)};
 });
 if(damage.status==='complete'){
  assert.equal(damage.tag,'SELECT');
  assert.deepEqual(damage.actual,damage.expected,'Maket12 degrees depend on KTP=84 / SSP.K84');
 }
 console.log('PASS Maket12.SV source-filtered by damage type KTP');
 // The formerly unfiltered Makets 17 and 19 must now use the same partial
 // Access RowSource. Their truncated >70… predicate cannot be called valid.
 for(const [m,field] of [['Макет17','P17'],['Макет19','ZP']]){
  const check=await p.evaluate(([m,field])=>{
   closeModal();current._children[m]=[{[field]:'В'}];
   solinWorkflow.editMaket(m,0);
   const control=document.getElementById('wf_'+field);
   const result=SolinDependentRules.options(m,field,{[field]:'В'},current,D.lesnichestvo?.[0]);
   return {control:control?.tagName,status:result?.status,
    actual:control?[...control.options].filter(x=>x.value&&!x.disabled).map(x=>x.value):[],
    expected:(result?.items||[]).map(x=>x.value),reason:control?.title};
  },[m,field]);
  assert.equal(check.control,'SELECT',m+'.'+field+' must be filtered');
  assert.equal(check.status,'partial','Truncated original SQL must be shown as incomplete');
  assert.deepEqual(check.actual,check.expected,'Only source-dependent options may appear for '+m);
  assert.match(check.reason,/конец порога не сохранился/);
 }
 console.log('PASS Maket17.P17 and Maket19.ZP use source-backed partial selector, no false validation');
 await p.evaluate(async()=>{closeModal();await SolinWorkspace.persist()});
 await boot(p);
 const persisted=await p.evaluate(async()=>{
  await SolinWorkspace.activate('723::4');
  const q=D.quarters['1'],r=q.compartments[0];
  return {quarter:q.meta.Klxr,stand:r.KlxrVD,zap:r._children.Макет10[0].ZAP};
 });
 assert.equal(String(persisted.quarter),'4');
 assert.equal(String(persisted.stand),'4');
 assert.equal(Number(persisted.zap),zoneFixed);
 console.log('PASS final iPhone-style reload: saved quarter zone, inherited stand zone and K59-corrected ZAP persist');
 // Large-scope audit: scan a real saved forest stand from the browser and
 // verify downloadable complete JSON and absence of silent data mutation.
 const originalWorkspace=await p.evaluate(()=>JSON.stringify(D.quarters));
 await p.evaluate(()=>{
  current=D.quarters['1'].compartments[0];show('card');renderComp();
 });
 assert.equal(await p.locator('#wfCardRelations').count(),1,
  'Card must offer an explicit dependency scan action');
 assert.equal(await p.locator('#wfCardRelations').isVisible(),true,
  'The dependency audit must be an accessible visible card action');
 await p.locator('#wfCardRelations').click();
 await p.locator('#wfSaveDependencyAudit').waitFor();
 assert.match(await p.locator('#solin-dependency-scan').innerText(),/Проверено выделов: 1/);
 assert.match(await p.locator('#solin-dependency-scan').innerText(),/исходные карточки и MDB не менялись/i);
 const [auditDownload]=await Promise.all([
  p.waitForEvent('download'),
  p.locator('#wfSaveDependencyAudit').click()
 ]);
 assert.equal(auditDownload.suggestedFilename(),'solin-dependent-audit.json');
 const [csvDownload]=await Promise.all([
  p.waitForEvent('download'),p.locator('#wfSaveDependencyCsv').click()
 ]);
 assert.equal(csvDownload.suggestedFilename(),'solin-dependent-audit.csv');
 assert.equal(await p.evaluate(()=>JSON.stringify(D.quarters)),originalWorkspace,
  'Running the full source dependency audit cannot modify the saved forest');
 await p.locator('#wfCloseDependencyAudit').click();
 console.log('PASS Chrome dependency audit dialog: card scope, complete downloadable JSON, no database edits');
 // Regression for iPhone "Древостой": IAR is disabled when KU is missing,
 // but the user must be able to set KU explicitly IN THIS SAME MODAL.
 // Changing KU must be confirmed and saved atomically with Maket10.
 await p.evaluate(()=>{
  closeModal();
  current=D.quarters['1'].compartments[0];
  current.KU=null;current._children.Макет10[0].IAR=null;
  solinWorkflow.editMaket('Макет10',0);
 });
 const missingLayer=await p.evaluate(()=>{
  const el=document.getElementById('wf_IAR');
  return {disabled:el.disabled,reason:document.getElementById('wfM10LayerHint').textContent,
   category:document.getElementById('wfM10KU').value};
 });
 assert.equal(missingLayer.disabled,true);
 assert.equal(missingLayer.category,'');
 assert.match(missingLayer.reason,/категори/i,
  'Disabled layer picker must explain exactly which upstream field is missing');
 const sourceStatus=await p.evaluate(()=>{
  const refs=SOLIN_REFS?.tables||{};
  return {sku:refs.SKU?.length||0,siar:refs.SIAR?.length||0,piap:refs.PIAP?.length||0,
   one:SolinDependentRules.allowedLayers({KU:1},refs)};
 });
 assert(sourceStatus.sku>0&&sourceStatus.siar>0,
  'Must use the physical published SKU and SIAR, not synthetic dropdown choices');
 assert.equal(sourceStatus.piap,0,'Reproduce missing PIAP on published iPhone refs-audit');
 assert.equal(sourceStatus.one.status,'partial','Missing PIAP must preserve SIAR candidates but remain unverified');
 const one=await p.locator('#wfM10KU').locator('option[value="1"]').count();
 assert.equal(one,1,'Original SKU must offer source-backed stand categories');
 await p.locator('#wfM10KU').selectOption('1');
 assert.match(await p.locator('#wfM10LayerHint').innerText(),/PIAP/);
 assert.equal(await p.locator('#wfM10LayerHint').getAttribute('data-status'),'partial');
 assert.equal(await p.locator('#wf_IAR').isEnabled(),true,
  'Choosing a KU with SIAR layers should immediately enable IAR');
 assert.deepEqual(await p.locator('#wf_IAR option').evaluateAll(els=>
  els.filter(x=>x.value&&!x.disabled).map(x=>x.value)),['1','2','7','8'],
  'Original KU=1 → SIAR.Ia=1 → PIAP must offer only the four real IAR codes');
 await p.locator('#wf_IAR').selectOption('1');
 await p.locator('#modalBody .formActions .secondary').click();
 assert.equal(await p.evaluate(()=>current.KU),null,
  'Canceling the Maket10 dialog must not mutate parent KU');
 assert.equal(await p.evaluate(()=>current._children.Макет10[0].IAR),null);
 await p.evaluate(()=>solinWorkflow.editMaket('Макет10',0));
 await p.locator('#wfM10KU').selectOption('1');
 await p.locator('#wf_IAR').selectOption('1');
 p.once('dialog',dialog=>dialog.accept());
 await p.locator('#wfSaveMaket').click();
 await p.waitForFunction(()=>current.KU===1&&current._children.Макет10[0].IAR===1);
 await p.evaluate(()=>{closeModal();solinWorkflow.editMaket('Макет10',0)});
 assert.equal(await p.locator('#wf_IAR').isEnabled(),true,
  'Saved forest KU should keep IAR enabled despite missing PIAP');
 assert.equal(await p.locator('#wf_IAR').inputValue(),'1');
 await p.evaluate(()=>closeModal());
 assert.equal(await p.evaluate(()=>current._children.Макет10[0].POR),'В',
  'Updating category and IAR must not lose species');
 assert.equal(await p.evaluate(()=>current._children.Макет10[0].KOEF),10,
  'Updating category and IAR must not lose coefficients');
 console.log('PASS Maket10 mobile layer edit: missing KU explained; choose source-backed category → original IAR options → atomic confirmed save');
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
 // The user's actual phone workflow: open "Древостой" from the simplified
 // stand view. KU=2 is already present, but physical PIAP is absent.
 await m.locator('#ce-cancel').click();
 await m.evaluate(()=>solinWorkflow.openMaket('Макет10'));
 await m.locator('#childContent [data-edit="0"]').click();
 assert.equal(await m.locator('#wfM10KU').inputValue(),'2');
 assert.equal(await m.locator('#wf_IAR').isEnabled(),true,
  'iPhone Maket10 IAR must not stay disabled when SIAR group exists without PIAP');
 assert.deepEqual(await m.locator('#wf_IAR option').evaluateAll(options=>
   options.filter(x=>x.value&&!x.disabled).map(x=>x.value)),['1','2','3','4','5','7','8']);
 assert.match(await m.locator('#wfM10LayerHint').innerText(),/PIAP/);
 assert.equal(await m.evaluate(()=>Number(current.KU)),2,
  'Opening a layer selector cannot silently rewrite category KU');
 console.log('PASS iPhone simplified Древостой: existing KU=2, editable IAR choices from SIAR without missing PIAP');
 assert.deepEqual(errors,[]);console.log('STOCK_AUTO_CORRECTION_UI_OK');
 await mobile.close();
}catch(e){console.error(e.stack||e);process.exitCode=1;}finally{await browser?.close();server.close();}})();
