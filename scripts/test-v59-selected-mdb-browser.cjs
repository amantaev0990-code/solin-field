'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {chromium,devices}=require('playwright');
const root=path.resolve(process.argv[2]||'www');
const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep))throw Error('invalid path');
  const bytes=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(bytes);
 }catch{res.writeHead(404).end();}
});
(async()=>{
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:process.env.SOLIN_BROWSER_CHANNEL});
  const page=await browser.newPage({...devices['Pixel 7'],viewport:{width:1067,height:667}});
  await page.addInitScript(()=>{window.Capacitor={getPlatform:()=> 'android',isNativePlatform:()=>true,Plugins:{SolinMdb:{export:async()=>({saved:true,verified:true,bytes:4096})}}};});
  page.on('pageerror',err=>console.error('PAGE_ERROR:',err.message));
  await page.route(url=>url.hostname!=='127.0.0.1',route=>route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>window.SolinWorkspace?.activeId&&window.SolinOfflineMDB);
  const available=await page.evaluate(async()=>{
   await window.SolinWorkspace.ready;
   await window.SolinWorkspace.activate(window.SolinWorkspace.activeId);
   window.Capacitor={getPlatform:()=> 'android',isNativePlatform:()=>true,
    Plugins:{SolinMdb:{export:async()=>({saved:true,verified:true,bytes:4096})}}};
   show('menuScreen');
   return Object.keys(D.quarters).map(Number).sort((a,b)=>a-b);
  });
  assert(available.length>=35,'test forest requires at least 35 quarters');
  await page.locator('#solin-mdb-export').click();
  await page.locator('#mdbQuarterRange').waitFor();
  const numbers=await page.locator('[data-mdb-quarter]').count();
  assert.equal(numbers,available.length,'one checkbox per actual quarter');
  assert.equal(await page.locator('[data-mdb-quarter]:checked').count(),available.length);
  await page.locator('#mdbSelectNone').click();
  assert.equal(await page.locator('[data-mdb-quarter]:checked').count(),0);
  await page.locator('#mdbQuarterRange').fill('1-35');
  await page.locator('#mdbApplyRange').click();
  const result=await page.evaluate(()=>{
   const selected=[...document.querySelectorAll('[data-mdb-quarter]:checked')].map(n=>Number(n.dataset.mdbQuarter));
   const payload=SolinMDBBridge.snapshot(new Set(selected));
   return {selected,quarters:payload.tables.Квартал.map(q=>q.KV),stands:payload.tables.Выдел.map(q=>q.KV),
    maket10:payload.tables.Макет10?.map(q=>q.KV)||[], total:Object.keys(D.quarters).length};
  });
  assert.equal(result.selected.length,35);
  for(const type of ['selected','quarters','stands','maket10'])
   assert(result[type].every(n=>n>=1&&n<=35),type+' includes unselected quarter');
  assert(result.total>=35,'Export altered the active forest');
  await page.locator('#mdbQuarterRange').fill('1-5000');
  await page.locator('#mdbApplyRange').click();
  assert.match(await page.locator('#mdbQuarterError').innerText(),/Неверные границы/);
  assert.equal(await page.locator('[data-mdb-quarter]:checked').count(),35,'Bad range must not mutate selection');
  await page.locator('#mdbQuarterCancel').click();
  await page.locator('#solin-mdb-export').click();
  await page.locator('#mdbQuarterRange').fill('36-70');
  await page.locator('#mdbApplyRange').click();
  assert.equal(await page.locator('[data-mdb-quarter]:checked').count(),35);
  const second=await page.evaluate(()=>{
   const chosen=new Set([...document.querySelectorAll('[data-mdb-quarter]:checked')].map(n=>Number(n.dataset.mdbQuarter)));
   return SolinMDBBridge.snapshot(chosen).tables.Выдел.map(r=>r.KV);
  });
  assert(second.every(n=>n>=36&&n<=70));
  await page.locator('#mdbQuarterCancel').click();
  console.log('V59_BROWSER_QUARTER_PICKER_OK: 1-35 and 36-70, invalid range safe, complete forest preserved');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(err=>{console.error(err);process.exitCode=1;});
