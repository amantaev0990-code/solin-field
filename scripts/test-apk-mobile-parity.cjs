/* Browser rendering parity: compare PWA and bundled APK pages in
 * isolated same-size/mobile Chrome contexts, exercising forestry + cards.
 * Execute AFTER npm run build. */
'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),
 path=require('node:path'),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),www=path.join(root,'www');
function serve(base,port) {
 const server=http.createServer((req,res)=>{
  try {
   const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
   const target=path.resolve(base,'.'+pathname);
   if(!target.startsWith(base+path.sep)&&target!==base){res.writeHead(403);return res.end();}
   const f=fs.statSync(target).isDirectory()?path.join(target,'index.html'):target;
   const extension=path.extname(f);
   const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.json':'application/json','.gz':'application/gzip','.webmanifest':'application/manifest+json'}[extension]||'application/octet-stream';
   res.setHeader('Content-Type',mime);res.end(fs.readFileSync(f));
  }catch(e){res.writeHead(404);res.end();}
 });
 return new Promise(ok=>server.listen(port,'127.0.0.1',()=>ok(server)));
}
async function snapshot(browser,port){
 const ctx=await browser.newContext({viewport:{width:412,height:875},isMobile:true,
  hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof D!=='undefined'&&D?.quarters&&window.SolinWorkspace);
 await page.evaluate(()=>SolinWorkspace.ready);
 let result=await page.evaluate(async()=>{
  const forests=await SolinWorkspace.list();
  const first=forests[0];if(!first)throw Error('Forest fixture missing');
  const home={
    tabs:[...document.querySelectorAll('.sectionTab')].map(e=>e.textContent.trim()),
    buttons:[...document.querySelectorAll('#homeScreen button')].map(e=>e.textContent.trim()),
    hero:document.querySelector('.homeHero h2')?.textContent
  };
  await SolinWorkspace.activate(first.id);
  const k=Object.keys(D.quarters).find(id=>D.quarters[id]?.compartments?.length);
  if(!k)throw Error('Stand fixture missing');
  const stand=D.quarters[k].compartments[0];
  current=stand;renderComp();show('card');
  const card={
   fields:[...document.querySelectorAll('#humanContent .humanField span')].map(x=>x.textContent),
   tabs:[...document.querySelectorAll('#childTabs button')].map(x=>x.textContent.trim()),
   title:document.querySelector('#cardTitle')?.textContent,
   edit:!!document.getElementById('wfEditBase'),
   sheets:[...document.querySelectorAll('#wfCardActions button')].map(e=>e.textContent.trim())
  };
  return {home,card,forestCount:forests.length,head:document.querySelector('.brand h1')?.textContent};
 });
 await page.locator('#wfEditBase').click();
 const modal=await page.evaluate(()=>({
  title:document.querySelector('#modalTitle')?.textContent,
  fields:document.querySelectorAll('#modal [data-ce-field]').length,
  maket10:!!document.getElementById('ce-section-10'),
  inputs:document.querySelectorAll('#modal input,#modal select').length
 }));
 result={...result,modal};
 await ctx.close();
 assert.deepEqual(errors,[],'No JS exceptions in PWA/APK entry point: '+errors.join('; '));
 return result;
}
(async()=>{let browser,a,b;
 try {
  a=await serve(root,8174);b=await serve(www,8175);
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const web=await snapshot(browser,8174),android=await snapshot(browser,8175);
  assert.deepEqual(android,web,'Native APK local UI must expose identical fields, screens, edit card and forest data to GitHub PWA.');
  console.log('APK_MOBILE_UI_PARITY_OK: same home, forests, cards, Maket10 and modal fields in PWA and staged native app');
 }finally{await browser?.close();for(const s of [a,b])if(s)await new Promise(ok=>s.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
