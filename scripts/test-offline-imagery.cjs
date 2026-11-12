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
  assert.equal(await page.locator('#offlineImportBtn').count(),0,'Import action must not obstruct the top toolbar');
  assert.equal(await page.locator('.field-map-tools button').filter({hasText:'Импорт офлайн-карты'}).count(),1,'Import remains in bottom map tools');
  assert.equal(await page.locator('.leaflet-bottom.leaflet-left .field-map-tools').count(),1,'Map tools must be anchored below the map');
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
  // Verify Leaflet actually paints a locally stored raster tile, not just
  // that the tile bytes exist somewhere in IndexedDB.
  await page.evaluate(()=>fieldMap.setView([0,0],0));
  await page.waitForFunction(()=>[...document.querySelectorAll('#fieldMap img.leaflet-tile')]
    .some(img=>img.src.startsWith('blob:')&&img.complete&&img.naturalWidth>0));

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
  const pyramid=await page.evaluate(async()=>{
   const sql=await initSqlJs({locateFile:name=>'./vendor/'+name}),db=new sql.Database();
   db.run('CREATE TABLE metadata(name TEXT,value TEXT)');db.run('CREATE TABLE tiles(zoom_level INTEGER,tile_column INTEGER,tile_row INTEGER,tile_data BLOB)');
   db.run("INSERT INTO metadata VALUES ('format','png')");
   const colors=['#ff0000','#00ff00','#0000ff','#ffff00'];
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle=colors[dy*2+dx];g.fillRect(0,0,256,256);
    const bytes=Uint8Array.from(atob(c.toDataURL().split(',')[1]),x=>x.charCodeAt(0));
    db.run('INSERT INTO tiles VALUES (5,?,?,?)',[16+dx,31-(10+dy),bytes]);
   }
   const bytes=db.export();db.close();const p=await SolinOfflineImagery.importFile(new File([bytes],'detail-only.mbtiles'));
   if(p.minZoom!==5||p.pyramidVersion)throw Error('Import must be ready without an expensive overview build');
   await SolinOfflineImagery.ensurePyramid(p); // explicit preparation remains available
   const blob=await SolinOfflineImagery.readTile(p.id,4,8,5),image=await createImageBitmap(blob),c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.drawImage(image,0,0);image.close();
   const pixels=[[64,64],[192,64],[64,192],[192,192]].map(([x,y])=>Array.from(g.getImageData(x,y,1,1).data));
   return {pixels,bounds:p.bounds,min:p.minZoom,max:p.maxZoom,version:p.pyramidVersion,overviews:p.overviewCount,cache:SolinOfflineImagery.cacheStats};
  });
  assert.equal(pyramid.bounds[0],0);assert.equal(pyramid.bounds[2],22.5);assert(pyramid.bounds[3]>pyramid.bounds[1]);assert.equal(pyramid.min,0);assert.equal(pyramid.max,5);assert.equal(pyramid.version,1);assert(pyramid.overviews>=5);
  const [red,green,blue,yellow]=pyramid.pixels;
  assert(red[0]>220&&red[1]<30&&red[2]<30);assert(green[1]>220&&green[0]<30);assert(blue[2]>220&&blue[0]<30);assert(yellow[0]>220&&yellow[1]>220&&yellow[2]<30);
  assert(pyramid.cache.tiles<=64&&pyramid.cache.bytes<=8*1024*1024);
  // Large vector layer: all geometry remains, only visible readable labels
  // are mounted. Zooming out removes detailed stand labels entirely.
  await page.evaluate(()=>{
   const features=[];for(let y=0;y<25;y++)for(let x=0;x<40;x++){
    const lon=59.2+x*.0002,lat=50.1+y*.0002;
    features.push({type:'Feature',properties:{Nкварт:1,Nвыд:y*40+x+1},geometry:{type:'Polygon',coordinates:[[[lon,lat],[lon+.00018,lat],[lon+.00018,lat+.00018],[lon,lat+.00018],[lon,lat]]]}});
   }
   const layer=makeGeoGroup({type:'FeatureCollection',features});
   const entry={cmf2:true,name:'performance-fixture',geometryEntries:[{source:'ВыдПород',layer}]};importedMapLayers.push(entry);window.__labelFixture=entry;
   fieldMap.stop().setView([50.1025,59.204],17,{animate:false});
   if(fieldMap.getZoom()!==17)throw Error('Map zoom refused: '+JSON.stringify({actual:fieldMap.getZoom(),max:fieldMap.getMaxZoom(),limit:fieldMap._limitZoom(17),center:fieldMap.getCenter(),loaded:fieldMap._loaded,animating:fieldMap._animatingZoom,zoomAnimation:fieldMap.options.zoomAnimation,active:SolinOfflineImagery.active?.name,layerLimit:fieldMap._layersMaxZoom}));
   SolinCmfLabelLayerV5.buildLabels(entry);
  });
  await page.waitForFunction(()=>window.__labelFixture.labelLayers.stands.getLayers().length>0,null,{timeout:8000}).catch(async()=>{
   const detail=await page.evaluate(()=>({zoom:fieldMap.getZoom(),center:fieldMap.getCenter(),maxZoom:fieldMap.getMaxZoom(),bounds:fieldMap.getBounds().toBBoxString(),group:fieldMap.hasLayer(__labelFixture.labelLayers.stands),count:__labelFixture.labelLayers.vCount,visible:__labelFixture.labelLayers.stands.getLayers().length,items:__labelFixture.labelLayers.standsItems.length,first:__labelFixture.labelLayers.standsItems[0]?.bounds?.toBBoxString()}));
   throw Error('CMF label fixture failed: '+JSON.stringify(detail));
  });
  const labels=await page.evaluate(()=>({visible:__labelFixture.labelLayers.stands.getLayers().length,source:__labelFixture.labelLayers.vCount,geometry:__labelFixture.geometryEntries[0].layer.getLayers().length}));
  assert.equal(labels.source,1000);assert.equal(labels.geometry,1000);assert(labels.visible<=220);
  await page.evaluate(()=>{fieldMap.stop().setView([50.1025,59.204],9,{animate:false});});
  await page.waitForFunction(()=>__labelFixture.labelLayers.stands.getLayers().length===0&&__labelFixture.labelLayers.quarters.getLayers().length===0);
  // Large MapInfo geometry must be cullable without losing the real full extent.
  const mapinfo=await page.evaluate(async()=>{
   const features=[];
   for(let y=0;y<25;y++)for(let x=0;x<40;x++){
    const lon=59.18+x*.003,lat=50.08+y*.003;
    features.push({type:'Feature',properties:{Nвыд:y*40+x+1},geometry:{type:'Polygon',
     coordinates:[[[lon,lat],[lon+.002,lat],[lon+.002,lat+.002],[lon,lat+.002],[lon,lat]]]}});
   }
   fieldMap.stop().setView([50.11,59.22],15,{animate:false});
   const entry=createMapInfoLayer({name:'213_1_ВыдПл',geojson:{type:'FeatureCollection',features},settings:''},'v57-test',0,1);
   const b=entry.layer.getBounds();entry.layer.addTo(fieldMap);
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const near=entry.layer.getLayers().length;
   fieldMap.stop().setZoom(8,{animate:false});
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const far=entry.layer.getLayers().length;
   fieldMap.removeLayer(entry.layer);
   fieldMap.getPane(entry.pane)?.remove();
   return {near,far,count:entry.count,full:b.isValid()};
  });
  assert.equal(mapinfo.count,1000);
  assert(mapinfo.full&&mapinfo.near>0&&mapinfo.near<1000,'Large MapInfo view must contain only local features');
  assert.equal(mapinfo.far,0,'Stand polygons should be hidden at overview zoom');
  assert.deepEqual(errors,[]);
  console.log('OFFLINE_IMAGERY_OK: nonblocking MBTiles import, bottom controls, restore/offline switch, optional four-quadrant overview pyramid, bounded cache, label culling');
  await ctx.close();
 }finally{if(browser)await browser.close();await new Promise(done=>server.close(done));}
})().catch(err=>{console.error(err);process.exitCode=1;});
