/* Regression for the reported tablet flight-mode, GNSS and creation bugs.
 * Real Chromium + IndexedDB; imagery network is controlled by this test. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),port=8187;
const server=http.createServer((req,res)=>{try{
 const p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(p!==root&&!p.startsWith(root+path.sep))throw Error('Path');
 const file=fs.statSync(p).isDirectory()?path.join(p,'index.html'):p;
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
}catch{res.writeHead(404);res.end();}});
(async()=>{let browser;
 try{
  await new Promise(r=>server.listen(port,'127.0.0.1',r));
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:700},hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',Plugins:{}};});
  await page.goto('http://127.0.0.1:'+port+'/');
  await page.waitForFunction(()=>window.SolinWorkspace&&window.SolinOfflineImagery&&window.SolinLocation);
  await page.evaluate(()=>SolinWorkspace.ready);
  // Exactly the video sequence: region -> owner -> district -> create.
  await page.locator('#newForestButton').click();
  await page.locator('#orgRegion').selectOption('200');
  const owner=await page.locator('#orgOwner').evaluate(el=>[...el.options].find(o=>o.textContent.includes('Актюбинское государственное'))?.value||el.options[1].value);
  await page.locator('#orgOwner').selectOption(owner);
  await page.locator('#orgDistrict').dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true});
  assert(await page.locator('#sap-search').isVisible());
  assert.notEqual(await page.evaluate(()=>document.activeElement.id),'sap-search','Small list should remain visible without forced keyboard');
  await page.setViewportSize({width:1280,height:340});
  await page.waitForFunction(()=>document.querySelector('.sap-sheet').getBoundingClientRect().bottom<=innerHeight+1);
  assert(await page.locator('.sap-close').isVisible(),'Picker close stays above landscape keyboard');
  await page.setViewportSize({width:1280,height:700});
  const choice=page.locator('.sap-option').filter({hasText:'Карагалинское'}).first();
  if(await choice.count())await choice.click();else await page.locator('.sap-option').nth(1).click();
  const before=await page.evaluate(()=>SolinWorkspace.list().then(x=>x.length));
  await page.locator('#saveForest').click();
  await page.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));
  assert.equal(await page.evaluate(()=>SolinWorkspace.list().then(x=>x.length)),before+1,'New forest must actually be created');
  const id=await page.evaluate(()=>SolinWorkspace.activeId);
  // Re-selecting an existing forest opens it, with no lost stand data.
  await page.evaluate(()=>SolinWorkspace.home());
  await page.locator('#newForestButton').click();
  await page.locator('#orgRegion').selectOption('200');await page.locator('#orgOwner').selectOption(owner);
  await page.locator('#orgDistrict').selectOption(await page.evaluate(()=>D.lesnichestvo[0].LESN.toString()));
  assert.match(await page.locator('#saveForest').innerText(),/Открыть существующее/);
  await page.locator('#saveForest').click();await page.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));
  assert.equal(await page.evaluate(()=>SolinWorkspace.list().then(x=>x.length)),before+1);
  // A storage failure remains visible; the old catch immediately erased it.
  await page.evaluate(()=>SolinWorkspace.home());await page.locator('#newForestButton').click();
  await page.locator('#orgRegion').selectOption('200');await page.locator('#orgOwner').selectOption(owner);await page.locator('#orgDistrict').selectOption('1');
  await page.evaluate(()=>{window.__realOpen=IDBFactory.prototype.open;IDBFactory.prototype.open=function(name,...args){if(name==='SOLIN_WORKSPACES_V1'){const request={error:Error('Проверка хранилища')};setTimeout(()=>request.onerror?.(),0);return request;}return window.__realOpen.call(this,name,...args);};});
  await page.locator('#saveForest').click();await page.waitForFunction(()=>document.getElementById('forestFormError').textContent.includes('Проверка хранилища'));
  assert.equal(await page.locator('#saveForest').isEnabled(),true);
  await page.evaluate(()=>{IDBFactory.prototype.open=window.__realOpen;closeModal();});
  await page.evaluate(async id=>{await SolinWorkspace.activate(id);openMapScreen();},id);
  await page.waitForFunction(()=>typeof fieldMap!=='undefined'&&fieldMap);
  // Controlled tile server. Assert complete area, then actual flight mode
  // with app reload and ZERO possible remote imagery reads.
  const raster=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#367c36';g.fillRect(0,0,256,256);return c.toDataURL('image/png').split(',')[1];}),'base64');
  let mode='ok',requests=0,partialSuccess=3;
  await context.route('https://tiles.maps.eox.at/**',async route=>{
   requests++;
   if(mode==='fail'||(mode==='partial'&&partialSuccess--<=0))return route.fulfill({status:503,body:'interrupted'});
   return route.fulfill({status:200,contentType:'image/png',body:raster});
  });
  const area=[59.2,50.1,59.21,50.11];
  const stored=await page.evaluate(async b=>{const expected=SolinOfflineImagery.plan(b,12).length,p=await SolinOfflineImagery.downloadArea(b,12);return {...p,expected};},area);
  assert.equal(stored.count,stored.expected);assert.equal(stored.status,'ready');assert.equal(requests,stored.total);
  // A failed connection must NEVER advertise a partial map as ready.
  mode='partial';
  await page.evaluate(async b=>{try{await SolinOfflineImagery.downloadArea(b,13);}catch{}},area);
  const partial=await page.evaluate(async()=>{const all=await SolinOfflineImagery.packs(undefined,true);return all.find(p=>p.status==='partial');});
  assert(partial);assert.equal(partial.count,3,'Previously downloaded tiles survive an interrupted connection');
  assert.equal(await page.evaluate(async id=>(await SolinOfflineImagery.packs()).some(p=>p.id===id),partial.id),false);
  mode='ok';
  const beforeResume=requests;
  const resumed=await page.evaluate(async p=>SolinOfflineImagery.downloadArea(p.bounds,p.maxZoom,{resumeId:p.id}),partial);
  assert.equal(resumed.status,'ready');assert.equal(resumed.id,partial.id);assert.equal(resumed.count,resumed.total);
  assert.equal(requests-beforeResume,resumed.total-3,'Resume only requests missing tiles');
  const remoteBefore=requests;
  await context.route('https://**/*',route=>route.abort());
  await page.reload();await page.waitForFunction(()=>window.SolinWorkspace);await page.evaluate(()=>SolinWorkspace.ready);
  await page.evaluate(async id=>{await SolinWorkspace.activate(id);openMapScreen();},id);
  await page.waitForFunction(()=>SolinOfflineImagery.active?.status==='ready');
  assert.equal(await page.evaluate(()=>SolinOfflineImagery.active.id),resumed.id);
  await page.evaluate(()=>fieldMap.setView([50.105,59.205],18));
  await page.waitForFunction(()=>[...document.querySelectorAll('#fieldMap img.leaflet-tile')].some(x=>x.src.startsWith('blob:')&&x.complete&&x.naturalWidth>0));
  assert.equal(requests,remoteBefore);
  assert.equal(await page.evaluate(()=>SolinOfflineImagery.packs('unrelated-forest').then(x=>x.length)),0);
  // Android bridge selection, timeout, continuous positions and cancellation.
  const gps=await page.evaluate(async()=>{
   let callback,cleared,options;
   Capacitor.Plugins.SolinLocation={getCurrentPosition:async opts=>{options=opts;return {coords:{latitude:50.105,longitude:59.205,accuracy:7}};},watchPosition:async(opts,cb)=>{callback=cb;return 'native-watch';},clearWatch:async({id})=>{cleared=id;}};
   const p=await SolinLocation.current();mapLocateMe();await Promise.resolve();await Promise.resolve();callback(p);
   const marker=!!userMarker,accuracy=!!userAccuracy,status=document.getElementById('mapGpsStatus').textContent;
   callback({coords:{latitude:50.106,longitude:59.206,accuracy:4}});
   const updated=userMarker.getLatLng().lat;mapLocateMe();await Promise.resolve();
   return {options,marker,accuracy,status,updated,cleared};
  });
  assert.equal(gps.options.timeout,60000);assert(gps.marker&&gps.accuracy);assert.match(gps.status,/±7/);assert.equal(gps.updated,50.106);assert.equal(gps.cleared,'native-watch');
  assert.deepEqual(errors,[]);
  console.log('TABLET_FIELD_FIXES_OK: actual new/existing forest creation, persistent storage errors, unforced small-list keyboard; complete/resumed satellite downloads, offline reload/overzoom, forest isolation; native GPS bridge, accuracy, continuous updates and stop');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
