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
  org.KTO=150000000;
  Object.assign(r,{KU:2,PLV:2,M3Pr:'В',M3B:'3',KlxrVD:8,GodT1:2015,STUR1:99,STUR:198});
  r._children.Макет10=[{...r._children.Макет10[0],POS:r.POS,LESN:r.LESN,KV:r.KV,KGLF:r.KGLF,VD:r.VD,
   IAR:1,POR:'В',KOEF:10,PH:6,POL:0.6,LET:5,PROI:7,ZAP:99}];
  const refs=window.SOLIN_REFS.tables;
  refs.Szap=[{Obl:150000000,p1:'В',LXZ:8,KUL:'.',v6:59,v7:80}];refs.SzapCK=[];refs.SSHB=[];
  const estimate=SolinCardCalculations.stockPerHectare(r,refs,org);
  if(estimate.status!=='complete'||estimate.expected!==35)throw Error('K59 test fixture invalid: '+JSON.stringify(estimate));
  current=r;renderComp();show('card');
  return {forestId:forest.id,address:{POS:r.POS,LESN:r.LESN,KV:r.KV,KGLF:r.KGLF,VD:r.VD}};
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
 await zap.fill('42');await zap.press('Tab');
 assert.equal(await val(p,'Макет10','ZAP'),35);
 assert.match(await p.locator('#ce-calc-notice').innerText(),/42.*35/s,'Repeat edit should replace stale message');
 console.log('PASS repeat correction updates original and corrected values in notice');
 await field(p,'Макет10','PH').fill('7');
 await field(p,'Макет10','PH').press('Tab');
 assert.equal(await val(p,'Макет10','ZAP'),48);
 assert.equal(await val(p,'base','STUR'),96);
 await field(p,'Макет10','POL').fill('0,5');
 await field(p,'Макет10','POL').press('Tab');
 assert.equal(await val(p,'Макет10','ZAP'),40);
 assert.equal(await val(p,'base','STUR'),80);
 await field(p,'base','PLV').fill('3');
 await field(p,'base','PLV').press('Tab');
 assert.equal(await val(p,'base','STUR1'),40);
 assert.equal(await val(p,'base','STUR'),120);
 console.log('PASS height, fullness and area recompute ZAP/STUR in original order');
 await p.locator('#ce-save').click();await p.waitForFunction(()=>!document.querySelector('#ce-form'));
 assert.equal(Number(await p.evaluate(()=>current._children.Макет10[0].ZAP)),40);
 await reopen(p,info);
 assert.equal(await val(p,'Макет10','ZAP'),40);
 assert.equal(await val(p,'base','STUR'),120);
 console.log('PASS save + reload persisted corrected stock');
 await p.locator('#ce-cancel').click();
 await p.evaluate(()=>{
  const base=current._children.Макет10[0];
  current._children.Макет10.push({...base,ZAP:10});
  current.STUR=0;current.STUR1=0;solinWorkflow.exitCard();
 });
 assert.equal(await p.evaluate(()=>current.STUR1),50);
 assert.equal(await p.evaluate(()=>current.STUR),150);
 console.log('PASS alternate exit aggregates Maket10 ZAP and recalculates STUR');
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
