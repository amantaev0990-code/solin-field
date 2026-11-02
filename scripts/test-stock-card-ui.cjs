/* Browser regression: manual ZAP vs K59 reference, totals, mobile quick entry and reopen. */
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const port=Number(process.env.TEST_PORT||8134);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]||'/'));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('forbidden');}
 try{const target=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
  res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');
  res.end(fs.readFileSync(target));}catch{res.writeHead(404);res.end('missing');}
});
let browser;
const field=(page,scope,name)=>page.locator('#ce-form [data-ce-scope="'+scope+'"][data-ce-field="'+name+'"]').first();
async function boot(page){
 await page.goto('http://127.0.0.1:'+port+'/');
 await page.waitForFunction(()=>window.SolinWorkspace&&window.SOLIN_REFS&&window.SolinCardEditor);
 await page.evaluate(()=>SolinWorkspace.ready);
}
async function openCard(page){
 return page.evaluate(async()=>{
  const forest=(await SolinWorkspace.list())[0];
  assertForest(forest);
  await SolinWorkspace.activate(forest.id);
  const all=Object.values(D.quarters).flatMap(q=>q.compartments);
  const card=all.find(r=>Number(r.PLV)>=1&&r._children?.Макет10?.length===1&&
    SolinCardCalculations.standStock(r).status==='complete'&&r._children.Макет10[0].POR===r.M3Pr);
  if(!card)throw Error('No single-row Maket10 fixture in bundled forest');
  current=card;renderComp();show('card');
  return {forestId:forest.id,address:{POS:card.POS,LESN:card.LESN,KV:card.KV,KGLF:card.KGLF,VD:card.VD},initialZAP:card._children.Макет10[0].ZAP};
  function assertForest(f){if(!f)throw Error('No bundled forest');}
 });
}
async function restoreCard(page,initial){
 await page.evaluate(async({forestId,address})=>{
  await SolinWorkspace.activate(forestId);
  current=Object.values(D.quarters).flatMap(q=>q.compartments)
   .find(r=>['POS','LESN','KV','KGLF','VD'].every(k=>String(r[k])===String(address[k])));
  if(!current)throw Error('Card not found after restart');
  renderComp();show('card');
 },initial);
 await page.locator('#wfEditBase').click();
 await page.locator('#ce-form').waitFor();
}
const val=async(page,scope,name)=>Number((await field(page,scope,name).inputValue()).replace(',','.'));
(async()=>{try{
 await new Promise(ok=>server.listen(port,'127.0.0.1',ok));
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 const desktop=await browser.newContext({viewport:{width:1320,height:900}});
 const page=await desktop.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await boot(page);const target=await openCard(page);
 await page.locator('#wfEditBase').click();
 await field(page,'base','PLV').fill('2');
 await field(page,'base','PLV').press('Tab');
 const zap=field(page,'Макет10','ZAP'),per=field(page,'base','STUR1'),total=field(page,'base','STUR');
 const initialPer=await per.inputValue();
 await zap.fill('7');
 await zap.press('1');
 assert.equal(await zap.inputValue(),'71','input must preserve the digits during typing');
 assert.equal(await per.inputValue(),initialPer,'derived stock must wait for field commit');
 await zap.press('Tab');
 assert.equal(await zap.inputValue(),'71','blur must not substitute K59 normative ZAP');
 assert.equal(await val(page,'base','STUR1'),71);
 assert.equal(await val(page,'base','STUR'),142);
 const notice=await page.locator('#ce-calc-notice').innerText();
 assert(!notice.includes('Запас на 1 га (макет 10)'),'ZAP must not be reported as corrected');
 console.log('PASS direct typing and blur: field ZAP preserved, STUR1/STUR derived');
 await field(page,'Макет10','PH').fill('2');
 await field(page,'Макет10','PH').press('Tab');
 await field(page,'Макет10','POL').fill('0,6');
 await field(page,'Макет10','POL').press('Tab');
 assert.equal(await zap.inputValue(),'71','height/fullness must not rewrite measured ZAP');
 await field(page,'base','PLV').fill('3');
 await field(page,'base','PLV').press('Tab');
 assert.equal(await val(page,'base','STUR1'),71);
 assert.equal(await val(page,'base','STUR'),213);
 console.log('PASS height/fullness/area edits preserve ZAP and update total');
 await page.locator('#ce-save').click();
 await page.waitForFunction(()=>!document.querySelector('#ce-form'));
 assert.equal(await page.evaluate(()=>current._children.Макет10[0].ZAP),71);
 assert.equal(await page.evaluate(()=>current.STUR),213);
 await page.reload();await page.waitForFunction(()=>window.SolinWorkspace&&window.SOLIN_REFS);await page.evaluate(()=>SolinWorkspace.ready);
 await restoreCard(page,target);
 assert.equal(await val(page,'Макет10','ZAP'),71);
 assert.equal(await val(page,'base','STUR1'),71);
 assert.equal(await val(page,'base','STUR'),213);
 console.log('PASS save and reopen: measured ZAP and derived total persist');
 await page.locator('#ce-cancel').click();
 await page.evaluate(()=>{
  const base=current._children.Макет10[0];
  current._children.Макет10.push({...base,ZAP:17});
  current.STUR=0;current.STUR1=0;
  solinWorkflow.exitCard();
 });
 assert.equal(await page.evaluate(()=>current.STUR1),88);
 assert.equal(await page.evaluate(()=>current.STUR),264);
 console.log('PASS standalone Exit aggregates matching Maket10 records, not just first row');
 await desktop.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));
 await boot(p);const mobileTarget=await openCard(p);
 await p.locator('#wfEditBase').click();
 await field(p,'base','PLV').fill('2');
 await field(p,'base','PLV').press('Tab');
 await p.locator('[data-ce-assist-row]').click();
 const index=await p.locator('#ce-table-Макет10 tbody tr').first().locator('[data-ce-field]').evaluateAll(xs=>xs.findIndex(x=>x.dataset.ceField==='ZAP'));
 assert(index>=0);
 await p.locator('[data-ce-assist-row-field="'+index+'"]').click();
 await p.locator('#ce-assist-value').fill('83');
 await p.locator('[data-ce-assist-apply]').click();
 assert.equal(await val(p,'Макет10','ZAP'),83);
 assert.equal(await val(p,'base','STUR1'),83);
 assert.equal(await val(p,'base','STUR'),166);
 await p.locator('[data-ce-assist-done]').click();
 await p.locator('#ce-save').click();
 await p.waitForFunction(()=>!document.querySelector('#ce-form'));
 await p.reload();await p.waitForFunction(()=>window.SolinWorkspace&&window.SOLIN_REFS);await p.evaluate(()=>SolinWorkspace.ready);
 await restoreCard(p,mobileTarget);
 assert.equal(await val(p,'Макет10','ZAP'),83);
 assert.equal(await val(p,'base','STUR'),166);
 console.log('PASS mobile quick entry and save/reopen: ZAP 83, STUR1 83, STUR 166');
 assert.deepEqual(errors,[]);console.log('STOCK_CARD_UI_OK');
 await mobile.close();
}catch(e){console.error(e.stack||e);process.exitCode=1;}finally{await browser?.close();server.close();}})();
