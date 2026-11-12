'use strict';
/* V56: on a 4 GB tablet a hidden list of hundreds of stands and hundreds
 * of source references must not be constructed while the main menu opens. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {chromium,devices}=require('playwright');
const root=path.resolve(process.argv[2]||'www');
const baseline=process.argv.includes('--baseline');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.bin':'application/octet-stream','.gz':'application/gzip'};
const server=http.createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep))throw Error('bad path');
  const bytes=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);
 }catch{if(!res.headersSent)res.writeHead(404).end();else res.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:process.env.SOLIN_BROWSER_CHANNEL});
  const page=await browser.newPage({...devices['Pixel 7'],viewport:{width:1080,height:720}});
  await page.route(u=>u.hostname!=='127.0.0.1',route=>route.abort());
  await page.addInitScript(()=>{
   window.__solinLongTasks=[];
   if(window.PerformanceObserver)try{
    new PerformanceObserver(items=>items.getEntries().forEach(x=>window.__solinLongTasks.push(Math.round(x.duration)))).observe({type:'longtask',buffered:true});
   }catch{}
  });
  const start=Date.now();
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SolinWorkspace?.ready);
  await page.evaluate(()=>window.SolinWorkspace.ready);
  const readyMs=Date.now()-start;
  // The unsigned CI payload deliberately omits private reference packs.
  // Cold-start responsiveness must not depend on those optional assets.
  await page.waitForTimeout(500);
  const initial=await page.evaluate(()=>({
   screen:document.querySelector('.screen.active')?.id,
   id:window.SolinWorkspace.activeId,
   quarters:Object.keys(D.quarters||{}).length,
   stands:Object.values(D.quarters||{}).reduce((n,q)=>n+(q.compartments?.length||0),0),
   quarterCards:document.querySelectorAll('#quarters .quarterCard').length,
   standCards:document.querySelectorAll('#allComps .compCard').length,
   refsCards:document.querySelectorAll('#friendlyRefs .refCard').length,
   longestTask:Math.max(0,...window.__solinLongTasks)
  }));
  console.log('V56_COLD_START '+JSON.stringify({baseline,readyMs,...initial}));
  assert.equal(initial.screen,'mainScreen','Must open main menu directly');
  assert.ok(initial.id&&initial.stands>0);
  if(!baseline){
   assert.equal(initial.quarterCards,0,'No hidden quarter list on startup');
   assert.equal(initial.standCards,0,'No hidden stand list on startup');
   assert.equal(initial.refsCards,0,'Do not render hidden source dictionaries on startup');
  }
  async function route(name){
   await page.evaluate(target=>window.show(target),name);
   await page.waitForFunction(target=>document.getElementById(target)?.classList.contains('active'),name);
   await page.waitForTimeout(150);
  }
  await route('quartersScreen');
  const qCount=await page.locator('#quarters .quarterCard').count();
  assert.ok(qCount>0,'Quarter navigation should render actual quarters');
  await route('allCompsScreen');
  assert.ok(await page.locator('#allComps .compCard').count()>0,'Stand navigation should render actual stands');
  await route('refsScreen');
  assert.ok(await page.locator('#friendlyRefs .refCard').count()>0,'Source dictionaries should render when opened');
  await route('mainScreen');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.evaluate(()=>window.SolinWorkspace.ready);
  assert.equal(await page.evaluate(()=>document.querySelector('.screen.active')?.id),'mainScreen');
  if(!baseline){
   assert.equal(await page.locator('#quarters .quarterCard').count(),0,'Reload again keeps hidden quarters lazy');
   assert.equal(await page.locator('#allComps .compCard').count(),0,'Reload again keeps hidden stands lazy');
  }
  console.log('V56 PERF PASS: main menu responsive with '+initial.stands+' stands; quarter/stand/reference views render on demand; repeated cold start passes.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
