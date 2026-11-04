/* Browser regression: multi-species and multi-layer Maket5 stock inside
 * the real SOLI-N card editor. Source-backed ZAP and K59 remain independent.
 */
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),port=8188;
const server=http.createServer((req,res)=>{
 try{
  const uri=decodeURIComponent(req.url.split('?')[0]),p=path.resolve(root,'.'+uri);
  if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const target=fs.statSync(p).isDirectory()?path.join(p,'index.html'):p;
  const ext=path.extname(target);
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.gz':'application/gzip'}[ext]||'application/octet-stream'));
  res.end(fs.readFileSync(target));
 }catch(e){res.writeHead(404);res.end();}
});
(async()=>{let browser;
 try{
  await new Promise(ok=>server.listen(port,'127.0.0.1',ok));
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1390,height:990}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port+'/');
  await page.waitForFunction(()=>window.SolinWorkspace&&window.SolinCardEditor&&window.SOLIN_REFS);
  await page.evaluate(()=>SolinWorkspace.ready);
  await page.evaluate(async()=>{
   const first=(await SolinWorkspace.list())[0];
   if(!first)throw Error('Missing forest fixture');
   await SolinWorkspace.activate(first.id);
   const r=Object.values(D.quarters).flatMap(q=>q.compartments||[]).find(r=>Number(r.PLV)>0);
   if(!r)throw Error('Missing stand fixture');
   Object.assign(r,{KU:2,PLV:2,M3Pr:'В',STUR1:0,STUR:0,M4SS:7});
   const address=Object.fromEntries(['POS','LESN','KV','KGLF','VD'].map(k=>[k,r[k]]));
   r._children={...r._children,Макет10:[
    {...address,IAR:1,POR:'В',KOEF:6,PH:6,POL:.6,LET:40,PROI:7,ZAP:30},
    {...address,IAR:1,POR:'Б',KOEF:4,PH:6,POL:.6,LET:40,PROI:7,ZAP:null},
    {...address,IAR:2,POR:'С',KOEF:10,PH:3,POL:.4,LET:20,PROI:7,ZAP:10},
    {...address,IAR:7,POR:'В',ZAP:4},
    {...address,IAR:8,POR:'Б',ZAP:12}
   ]};
   current=r;renderComp();show('card');SolinCardEditor.open(r);
  });
  await page.locator('#ce-form').waitFor();
  assert.match(await page.locator('#ce-stock-audit').innerText(),/всех пород живых ярусов/i);
  for(const [id,expected] of [['ce-stock-live','40'],['ce-stock-fresh','12'],['ce-stock-drywood','7'],['ce-stock-single','4']]){
   assert.match(await page.locator('#'+id).innerText(),new RegExp('^'+expected+'$'),
    'Wrong Maket5 summary '+id);
  }
  const audit=await page.locator('#ce-stock-audit').innerText();
  assert.match(audit,/В: 30/);assert.match(audit,/С: 10/);
  assert.match(audit,/состав: В 6 \\+ Б 4/,'Companion species must appear in layer composition');
  assert.match(audit,/запас ЯРУСА|запас всего яруса/i,'The UI must not claim a separate B species volume');
  assert.match(audit,/24 м³ на выдел/,'Fresh drywood total by area must be visible');
  assert.match(audit,/14 м³ на выдел/,'M4SS separate total by area must be visible');
  assert.match(audit,/8 м³ на выдел/,'Isolated trees separate total by area must be visible');
  const row2=page.locator('#ce-form [data-ce-scope="Макет10"][data-ce-field="ZAP"][data-ce-row="2"]');
  await row2.fill('15');await row2.press('Tab');
  assert.equal(Number(await page.locator('#ce-form [data-ce-scope="base"][data-ce-field="STUR1"]').inputValue()),45);
  assert.equal(Number(await page.locator('#ce-form [data-ce-scope="base"][data-ce-field="STUR"]').inputValue()),90);
  assert.match(await page.locator('#ce-stock-live').innerText(),/^45$/);
  assert.match(await page.locator('#ce-stock-fresh').innerText(),/^12$/);
  assert.equal(await page.evaluate(()=>current.STUR1),0,'Editing must remain in a draft before Save');
  // If somebody fills an additional POR's ZAP in the SAME tier, its meaning
  // (component share vs repeated whole-tier stock) is not proven. Block.
  const companion=page.locator('#ce-form [data-ce-scope="Макет10"][data-ce-field="ZAP"][data-ce-row="1"]');
  await companion.fill('20');await companion.press('Tab');
  assert.equal(await page.locator('#ce-stock-audit').getAttribute('data-stock-status'),'ambiguous');
  assert.match(await page.locator('#ce-stock-live').innerText(),/^—$/);
  assert.equal(Number(await page.locator('#ce-form [data-ce-scope="base"][data-ce-field="STUR1"]').inputValue()),45,
   'Ambiguous extra POR stock must not silently replace tier total');

  assert.deepEqual(errors,[]);
  console.log('MAKET5_MULTI_BROWSER_OK: source-style В6+Б4 one tier ZAP, extra layer 40->45 m3/ha, deadwood separately; extra second species ZAP ambiguity blocked');
 }finally{await browser?.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
