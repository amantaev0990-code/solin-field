/* Real Chrome test: CarryMap-style offline MBTiles stays available per forest
 * across reloads and can render with network imagery requests unavailable. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),port=8173;
const server=http.createServer((req,res)=>{try{
 const pathname=decodeURIComponent(req.url.split('?')[0]),file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
 const p=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
 res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':p.endsWith('.wasm')?'application/wasm':'application/octet-stream');
 res.end(fs.readFileSync(p));
}catch(_){res.writeHead(404);res.end();}});
(async()=>{let browser;
 try{
  await new Promise(done=>server.listen(port,'127.0.0.1',done));
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const ctx=await browser.newContext({viewport:{width:850,height:920},isMobile:true,hasTouch:true});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('http://127.0.0.1:'+port+'/');
  await page.waitForFunction(()=>window.SolinWorkspace&&window.SolinOfflineImagery&&window.initSqlJs);
  await page.evaluate(()=>SolinWorkspace.ready);
  const forest=await page.evaluate(async()=>{
   const f=(await SolinWorkspace.list())[0];if(!f)throw Error('No forest');
   await SolinWorkspace.activate(f.id);
   openMapScreen();
   return f.id;
  });
  await page.waitForFunction(()=>!!window.fieldMap);
  assert.equal(await page.locator('#offlineBtn').isDisabled(),true,'Offline mode unavailable before import');
  assert.equal(await page.locator('#offlineImportBtn').count(),1);
  const pack=await page.evaluate(async()=>{
   const sql=await initSqlJs({locateFile:name=>'./vendor/'+name});
   const db=new sql.Database();
   db.run('CREATE TABLE metadata (name TEXT, value TEXT)');
   db.run('CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)');
   db.run("INSERT INTO metadata VALUES ('format','png')");
   db.run("INSERT INTO metadata VALUES ('bounds','58.94556,49.88939,59.66651,50.34764')");
   const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;
   const png=Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0));
   db.run('INSERT INTO tiles VALUES (0,0,0,?)',[png]);
   const bytes=db.export();db.close();
   const stored=await SolinOfflineImagery.importFile(new File([bytes],'test-forest.mbtiles'));
   const tile=await SolinOfflineImagery.readTile(stored.id,0,0,0);
   if(!tile||tile.type!=='image/png'||tile.size<30)throw Error('Tile not in indexedDB');
   return {id:stored.id,forest:stored.forest,count:stored.count,status:stored.status,minZoom:stored.minZoom,maxZoom:stored.maxZoom,size:tile.size};
  });
  assert.equal(pack.forest,forest);assert.equal(pack.count,1);assert.equal(pack.status,'ready');
  assert.equal(await page.locator('#offlineBtn').isEnabled(),true);
  assert(await page.locator('#offlineBtn').evaluate(el=>el.classList.contains('active')),
   'Offline imagery should be selected automatically after download/import');
  // Do not allow one forest to see tiles saved under another owner's address.
  assert.equal(await page.evaluate(()=>SolinOfflineImagery.packs('999::99').then(a=>a.length)),0);
  await page.reload();
  await page.waitForFunction(()=>window.SolinWorkspace&&window.SolinOfflineImagery);
  await page.evaluate(()=>SolinWorkspace.ready);
  await page.evaluate(async id=>{await SolinWorkspace.activate(id);openMapScreen();},forest);
  await page.waitForFunction(()=>window.SolinOfflineImagery.active?.status==='ready');
  assert.equal(await page.evaluate(()=>SolinOfflineImagery.active.id),pack.id);
  assert.equal(await page.evaluate(async id=>(await SolinOfflineImagery.readTile(id,0,0,0))?.size,pack.id),pack.size);
  await page.evaluate(()=>setBaseMap('google'));
  assert.equal(await page.locator('#offlineBtn').evaluate(el=>el.classList.contains('active')),false);
  await page.locator('#offlineBtn').click();
  assert.equal(await page.locator('#offlineBtn').evaluate(el=>el.classList.contains('active')),true);
  assert.match(await page.locator('#offlineImageryStatus').innerText(),/Офлайн-снимок/);
  assert.deepEqual(errors,[]);
  console.log('OFFLINE_IMAGERY_OK: import raster MBTiles, store tile in IndexedDB, restore after reload, forestry isolation, offline/online switch');
  await ctx.close();
 }finally{if(browser)await browser.close();await new Promise(done=>server.close(done));}
})().catch(err=>{console.error(err);process.exitCode=1;});
