/* SOLI-N keyboard species codes and zero bonitet until verified K58. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),port=8169;
const server=http.createServer((req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}const p=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(p));}catch(_){res.writeHead(404);res.end();}});
(async()=>{let browser;
 try{
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port+'/');
  await page.waitForFunction(()=>window.SolinWorkspace&&window.SolinSpeciesEntry&&window.SolinHuman);
  await page.evaluate(()=>SolinWorkspace.ready);
  await page.waitForFunction(()=>{const list=window.SolinHuman?.lookup?.('ВыделВ','M3Pr');return list&&list['В']&&list['ОС'];});
  const fixture=await page.evaluate(async()=>{
   const forest=(await SolinWorkspace.list())[0];if(!forest)throw Error('No active forest fixture');
   await SolinWorkspace.activate(forest.id);
   const k=Object.keys(D.quarters).find(x=>D.quarters[x]?.quarterRows?.length||D.quarters[x]?.meta);
   if(!k)throw Error('No quarter fixture');
   const vd=Math.max(0,...(D.quarters[k].compartments||[]).map(r=>Number(r.VD)||0))+101;
   openCompForm(k);
   return {k,vd};
  });
  assert.equal(await page.locator('#newBon').count(),0,'Manual bonitet removed from new stand form');
  assert(await page.locator('#newPOR__quick').isVisible(),'Quick species search visible in create form');
  await page.locator('#newPOR__quick').fill('В');
  const popupLayout=await page.evaluate(()=>{
   const input=document.querySelector('#newPOR__quick'),popup=document.querySelector('.solin-species-results');
   const a=input.getBoundingClientRect(),b=popup.getBoundingClientRect();
   return {font:parseFloat(getComputedStyle(input).fontSize),below:b.top>=a.bottom-1,
    top:b.top,fieldBottom:a.bottom,popupWidth:b.width,fieldWidth:a.width};
  });
  assert(popupLayout.font>=16,'iPhone typing field must not trigger Safari auto-zoom');
  assert(popupLayout.below,'Suggestions must always be beneath the typing field');
  assert(popupLayout.popupWidth>=Math.min(230,popupLayout.fieldWidth));

  assert.equal(await page.locator('#newPOR').inputValue(),'В','Single original code should choose elm (вяз)');
  await page.locator('#newPOR__quick').fill('ос');
  assert.equal(await page.locator('#newPOR').inputValue(),'ОС','Cyrillic casefold must choose aspen (осина)');
  await page.locator('#newPOR__quick').fill('вя');
  assert.equal(await page.locator('#newPOR').inputValue(),'','Ambiguous prefix must not choose an arbitrary elm species');
  assert(await page.locator('.solin-species-results [data-species-index]').count()>1,'Ambiguous code should show candidates');
  await page.locator('#newPOR__quick').fill('В');
  await page.locator('#newVD').fill(String(fixture.vd));
  await page.locator('#newPLV').fill('1');
  await page.locator('#newKU').selectOption({index:1});
  await page.locator('#modalBody button.primary').click();
  await page.waitForFunction(({k,vd})=>D.quarters?.[k]?.compartments.some(r=>Number(r.VD)===vd),fixture);
  const values=await page.evaluate(({k,vd})=>{const r=D.quarters[k].compartments.find(x=>Number(x.VD)===vd);return {species:r.M3Pr,bonitet:r.M3B};},fixture);
  assert.equal(values.species,'В');
  assert.equal(values.bonitet,0,'Unknown bonitet remains zero after initial stand creation');
  await page.evaluate(({k,vd})=>{const r=D.quarters[k].compartments.find(x=>Number(x.VD)===vd);SolinCardEditor.open(r);},fixture);
  await page.locator('#ce-form').waitFor();
  const districtSelect=page.locator('#ce-form select[data-quarter-picker="Raion"]');
  assert.equal(await districtSelect.count(),1,'District must be a separate native name picker in the full card');
  const districtLabel=await districtSelect.locator('option[value="156000000"]').textContent();
  assert.equal(districtLabel,'Хромтауский район','KATO code must not appear inside district name');
  await districtSelect.selectOption('356400000');
  assert.equal(await page.locator('#ce-form .quarter-code-readonly').inputValue(),'356400000','Selected district code must display separately');

  const quick=page.locator('#ce-form .solin-species-query').filter({has:page.locator('nonexistent-x')});
  const main=page.locator('#ce-form select[data-ce-field="M3Pr"]');
  const m10=page.locator('#ce-form select[data-ce-scope="Макет10"][data-ce-field="POR"]').first();
  assert.equal(await main.inputValue(),'В','Original main species persisted as source code');
  assert.equal(await m10.count(),1,'Maket 10 row species selector present');
  const m10Quick=page.locator('#'+(await m10.getAttribute('id'))+'__quick');
  assert(await m10Quick.isVisible(),'Maket 10 species quick typing visible');
  await m10Quick.fill('ос');
  assert.equal(await districtSelect.inputValue(),'356400000','Maket10 dependency refresh must not reset district choice');

  assert.equal(await m10.inputValue(),'ОС','Maket 10 code ОС selected by typing ос');
  await m10Quick.fill('В');
  assert.equal(await m10.inputValue(),'В','Maket 10 code В selected by typing one letter');
  await page.locator('#ce-cancel').click();
  // Also check the quarter-creation form, not only the taxation-card header.
  await page.evaluate(()=>openQuarterForm());
  const quarterDistrict=page.locator('#newRaion');
  assert.equal(await quarterDistrict.locator('option[value="356400000"]').textContent(),'Шетский район');
  assert.equal(await quarterDistrict.locator('option[value="153400000"]').textContent(),'Айтекебийский район');
  await quarterDistrict.selectOption('156000000');
  assert.equal(await page.locator('#modalBody .quarter-code-readonly').inputValue(),'156000000');
  await page.locator('#modalBody .quarter-code-readonly').evaluate(el=>{if(!el.readOnly)throw Error('KATO value should be read-only');});
  await page.locator('#modal .modalHead .close').click();
  // In the real card editor, Maket 10 source fields must update M3B in the
  // draft automatically; the persisted record changes only after Save.
  await page.evaluate(({k,vd})=>{
   const record=D.quarters[k].compartments.find(x=>Number(x.VD)===vd);
   Object.assign(record,{KU:1,M3Pr:'В',M3B:0});
   record._children={Макет10:[{POS:record.POS,LESN:record.LESN,KV:record.KV,KGLF:record.KGLF,VD:record.VD,
    IAR:1,POR:'В',KOEF:10,PROI:7,POL:0.5,LET:5,PH:2,ZAP:40}]};
   SOLIN_REFS.tables.SSHB=[{Происх:7,Возр:5,ВозрН:5,ВозрК:6,Н1б:99,Н1а:99,Н1:5,Н2:4,Н3:3,Н4:1,Н5:0,Н5а:0,Н5б:0}];
   SolinCardEditor.open(record);
  },fixture);
  await page.locator('#ce-form select[data-ce-scope="Макет10"][data-ce-field="POR"]').first().evaluate(el=>el.dispatchEvent(new Event('change',{bubbles:true})));
  await page.waitForFunction(()=>document.querySelector('#ce-form select[data-ce-field="M3B"][data-ce-scope="base"]')?.value==='4');
  assert.equal(await page.evaluate(({k,vd})=>D.quarters[k].compartments.find(x=>Number(x.VD)===vd).M3B,fixture),0,
   'K58 correction must not persist before Save');
  await page.locator('#ce-save').click();
  await page.waitForFunction(({k,vd})=>String(D.quarters[k].compartments.find(x=>Number(x.VD)===vd).M3B)==='4',fixture);
  // Pure audited K58 contract: a single eligible Maket 10 row auto-produces bonitet 4.
  const K58=await page.evaluate(()=>{
   const scale={Происх:7,Возр:5,ВозрН:5,ВозрК:6,Н1б:99,Н1а:99,Н1:5,Н2:4,Н3:3,Н4:1,Н5:0,Н5а:0,Н5б:0};
   const r={POS:213,LESN:2,KV:1,KGLF:27,VD:1,KU:1,PLV:2,M3Pr:'В',M3B:0,_children:{Макет10:[{IAR:1,POR:'В',PROI:7,POL:0.5,LET:5,PH:2,ZAP:40}]}};
   const calc=SolinCardCalculations.bonitet(r,{SSHB:[scale]});
   const waiting=SolinCardCalculations.bonitet({...r,_children:{Макет10:[]}},{SSHB:[scale]});
   return {status:calc.status,value:calc.expected,waiting:waiting.status};
  });
  assert.equal(K58.status,'complete');assert.equal(K58.value,'4');
  assert.equal(K58.waiting,'waiting');
  assert.deepEqual(errors,[]);
  console.log('SPECIES_QUICK_OK: iOS 16px input, downward popup, Maket10 entry, named Raion with separate KATO code, K58');
  await context.close();
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
