/* SOLI-N Field: CarryMap-style offline raster packages.
 * Store user-owned/licensed MBTiles in IndexedDB as raster tiles, separated
 * by forestry workspace; do not cache Google/OSM imagery without permission.
 * Original MDB and card data are never touched by this module. */
(()=>{'use strict';
 const DB_NAME='SOLIN_FIELD_OFFLINE_IMAGERY_V1',VERSION=1;
 const MAX_FILE=350*1024*1024,MAX_TILES=25000,CHUNK=80;
 let dbPromise=null,activeLayer=null,activePack=null,mapRef=null,loading=false,downloadAbort=null,restoreEpoch=0;
 // 2016 is CC BY 4.0, including commercial embedding and offline tiles.
 // Newer EOX mosaics and Google tiles are deliberately NOT downloaded.
 const SOURCE={name:'Sentinel-2 · 2016–2017 · 10 м',maxZoom:14,
  url:'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
  attribution:'<a href="https://cloudless.eox.at">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 &amp; 2017) · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>'};
 const MAX_DOWNLOAD=5000;
 const text=s=>String(s??'');
 const html=s=>text(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[ch]));
 const forestId=()=>window.SolinWorkspace?.activeId||null;
 const tmsToXyz=(z,row)=>2**z-1-row;
 const tileId=(id,z,x,y)=>id+'|'+z+'/'+x+'/'+y;
 function db(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB_NAME,VERSION);
   req.onupgradeneeded=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains('packs'))db.createObjectStore('packs',{keyPath:'id'});
    if(!db.objectStoreNames.contains('tiles')){
     const store=db.createObjectStore('tiles',{keyPath:'key'});
     store.createIndex('packId','packId',{unique:false});
    }
   };
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>{dbPromise=null;reject(req.error||Error('Невозможно открыть хранилище снимков'));};
  });
  return dbPromise;
 }
 function done(tx){return new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||Error('Ошибка записи снимков'));
  tx.onabort=()=>reject(tx.error||Error('Запись офлайн-карты отменена'));
 });}
 async function get(store,key){
  const d=await db();
  return new Promise((resolve,reject)=>{
   const q=d.transaction(store,'readonly').objectStore(store).get(key);
   q.onsuccess=()=>resolve(q.result||null);
   q.onerror=()=>reject(q.error);
  });
 }
 async function packs(forest=forestId(),includePartial=false){
  if(!forest)return [];
  const d=await db();
  return new Promise((resolve,reject)=>{
   const req=d.transaction('packs','readonly').objectStore('packs').getAll();
   req.onsuccess=()=>resolve((req.result||[]).filter(x=>x.forest===forest&&(x.status==='ready'||includePartial)).sort((a,b)=>b.created-a.created));
   req.onerror=()=>reject(req.error);
  });
 }
 async function putPack(pack){
  const d=await db(),tx=d.transaction('packs','readwrite');
  tx.objectStore('packs').put(pack);
  await done(tx);
 }
 async function writeBatch(rows){
  if(!rows.length)return;
  const d=await db(),tx=d.transaction('tiles','readwrite'),store=tx.objectStore('tiles');
  for(const row of rows)store.put(row);
  await done(tx);
 }
 async function remove(id){
  if(activePack?.id===id)deactivate();
  const d=await db(),tx=d.transaction(['tiles','packs'],'readwrite');
  const index=tx.objectStore('tiles').index('packId');
  const cursor=index.openKeyCursor(IDBKeyRange.only(id));
  cursor.onsuccess=()=>{
   const row=cursor.result;
   if(row){tx.objectStore('tiles').delete(row.primaryKey);row.continue();}
  };
  tx.objectStore('packs').delete(id);
  await done(tx);
  await restore();
 }
 function tileMime(bytes){
  if(bytes.length>=4&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return 'image/png';
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
  if(bytes.length>=12&&bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&bytes[8]===0x57)return 'image/webp';
  return null;
 }
 const rasterCache=new Map();let cacheBytes=0;
 async function readTile(id,z,x,y){
  const key=tileId(id,z,x,y),cached=rasterCache.get(key);
  if(cached){rasterCache.delete(key);rasterCache.set(key,cached);return cached;}
  const blob=(await get('tiles',key))?.blob||null;
  if(blob){rasterCache.set(key,blob);cacheBytes+=blob.size;
   while(rasterCache.size>64||cacheBytes>8*1024*1024){const [old,value]=rasterCache.entries().next().value;rasterCache.delete(old);cacheBytes-=value.size;}}
  return blob;
 }
 const pyramidJobs=new Map();
 async function tileKeys(id){
  const d=await db();return new Promise((resolve,reject)=>{
   const q=d.transaction('tiles').objectStore('tiles').index('packId').getAllKeys(IDBKeyRange.only(id));
   q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
  });
 }
 async function bitmap(blob){
  if(window.createImageBitmap)return createImageBitmap(blob);
  return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(blob);
   img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Повреждённое изображение карты'));};img.src=url;});
 }
 async function ensurePyramid(pack,signal){
  if(pack.pyramidVersion===1)return pack;
  if(pyramidJobs.has(pack.id))return pyramidJobs.get(pack.id);
  const job=(async()=>{
   const levels=new Map();
   for(const key of await tileKeys(pack.id)){
    const [z,x,y]=key.slice(pack.id.length+1).split('/').map(Number);
    if(!levels.has(z))levels.set(z,new Map());levels.get(z).set(x+'/'+y,{x,y});
   }
   // MBTiles may omit bounds. Infer the actual finest-level coverage,
   // before adding global overview tiles, so import still zooms to its map.
   let validBounds=false;try{if(pack.bounds){extent(pack.bounds);validBounds=true;}}catch(_){}
   if(!validBounds){
    const finest=[...(levels.get(pack.maxZoom)||new Map()).values()];
    if(finest.length){
     let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
     for(const {x,y}of finest){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
     const count=2**pack.maxZoom,lat=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/count)))*180/Math.PI;
     pack.bounds=[x0/count*360-180,lat(y1),x1/count*360-180,lat(y0)];
    }
   }
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
   const ctx=canvas.getContext('2d',{alpha:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
   let added=0;
   for(let z=pack.maxZoom-1;z>=0;z--){
    const parents=new Map(),children=levels.get(z+1)||new Map(),existing=levels.get(z)||new Map();
    for(const {x,y} of children.values()){const px=Math.floor(x/2),py=Math.floor(y/2),k=px+'/'+py;if(!existing.has(k))parents.set(k,{x:px,y:py});}
    for(const [key,{x,y}] of parents){
     if(signal?.aborted)throw Error('Загрузка приостановлена');
     ctx.clearRect(0,0,256,256);let painted=0;
     for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++){
      const blob=await readTile(pack.id,z+1,2*x+dx,2*y+dy);if(!blob)continue;
      const image=await bitmap(blob);try{ctx.drawImage(image,dx*128,dy*128,128,128);painted++;}finally{image.close?.();}
     }
     if(!painted)continue;
     const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.75));
     if(!blob)throw Error('Не удалось сохранить обзорный масштаб');
     await writeBatch([{key:tileId(pack.id,z,x,y),packId:pack.id,blob,overview:true}]);
     existing.set(key,{x,y});added++;
     if(added%16===0){setStatus('Подготавливаю плавное масштабирование: '+added+' обзорных фрагментов');await new Promise(r=>setTimeout(r,0));}
    }
    levels.set(z,existing);
   }
   pack.overviewCount=(pack.overviewCount||0)+added;pack.pyramidVersion=1;pack.minZoom=0;
   await putPack(pack);return pack;
  })();
  pyramidJobs.set(pack.id,job);
  try{return await job;}finally{pyramidJobs.delete(pack.id);}
 }
 async function importFile(file){
  const forest=forestId();
  if(!forest)throw Error('Сначала откройте нужное лесничество');
  if(loading)throw Error('Дождитесь завершения предыдущей загрузки');
  if(!file||file.size<100||file.size>MAX_FILE)throw Error('Выберите растровый MBTiles до 350 МБ');
  if(!/\.mbtiles$/i.test(file.name||''))throw Error('Требуется файл .mbtiles с растровыми спутниковыми снимками');
  if(!window.initSqlJs)throw Error('Модуль чтения MBTiles (SQL.js) не загружен');
  loading=true;
  const pack={id:forest+'|'+Date.now()+'|'+Math.floor(Math.random()*10000),forest,
   name:file.name,size:file.size,created:Date.now(),status:'installing',count:0,
   minZoom:99,maxZoom:0,bounds:null};
  let sql=null;
  try{
   setStatus('Читаю MBTiles: '+file.name+'…');
   const wasm=await window.initSqlJs({locateFile:name=>'./vendor/'+name});
   sql=new wasm.Database(new Uint8Array(await file.arrayBuffer()),{readonly:true});
   const data=sql.exec("SELECT name,value FROM metadata")||[];
   const metadata=Object.fromEntries((data[0]?.values||[]).map(row=>[String(row[0]),String(row[1])]));
   if(['pbf','mvt','vector'].includes((metadata.format||'').toLowerCase()))throw Error('Векторный MBTiles не подходит; требуется растровая карта PNG/JPEG/WEBP');
   const count=Number(sql.exec('SELECT COUNT(*) FROM tiles')[0]?.values?.[0]?.[0]||0);
   if(!Number.isSafeInteger(count)||count<1||count>MAX_TILES)
    throw Error('Пакет должен содержать от 1 до '+MAX_TILES+' тайлов; большой район разделите на пакеты');
   if(metadata.bounds){
    const values=metadata.bounds.split(',').map(Number);
    if(values.length===4&&values.every(Number.isFinite))pack.bounds=values;
   }
   await putPack(pack);
   const stmt=sql.prepare('SELECT zoom_level,tile_column,tile_row,tile_data FROM tiles');
   let batch=[];
   while(stmt.step()){
    const item=stmt.getAsObject(),z=Number(item.zoom_level),x=Number(item.tile_column),
      tmsY=Number(item.tile_row);
    if(!Number.isInteger(z)||z<0||z>22||!Number.isInteger(x)||!Number.isInteger(tmsY)||
      x<0||tmsY<0||x>=2**z||tmsY>=2**z)throw Error('Недопустимые координаты тайла MBTiles');
    const bytes=item.tile_data;
    if(!(bytes instanceof Uint8Array)||bytes.byteLength>1500000)throw Error('Повреждённый или слишком большой тайл');
    const mime=tileMime(bytes);
    if(!mime)throw Error('MBTiles содержит нерастровые данные или неподдерживаемое изображение');
    batch.push({key:tileId(pack.id,z,x,tmsToXyz(z,tmsY)),packId:pack.id,
      blob:new Blob([bytes],{type:mime})});
    pack.count++;
    pack.minZoom=Math.min(pack.minZoom,z);pack.maxZoom=Math.max(pack.maxZoom,z);
    if(batch.length>=CHUNK){
     await writeBatch(batch);batch=[];
     setStatus('Сохраняю офлайн-снимок: '+pack.count+' из '+count+' фрагментов');
    }
   }
   stmt.free();
   await writeBatch(batch);
   if(pack.count!==count)throw Error('Количество считанных фрагментов не совпало с пакетом');
   sql.close();sql=null; // Release the large SQLite buffer before rendering.
   // MBTiles already provides its native levels. Eagerly creating thousands
   // of lower-level tiles froze import on tablets with limited memory.
   pack.status='ready';await putPack(pack);
   await navigator.storage?.persist?.().catch(()=>false);
   if(forest===forestId()){await select(pack);await showStored();}
   setStatus('Офлайн-снимок сохранён для лесничества: '+pack.count+' фрагментов, масштабы '+pack.minZoom+'–'+pack.maxZoom);
   return pack;
  }catch(e){
   try{await remove(pack.id);}catch(_){}
   setStatus('Не удалось сохранить снимок: '+e.message);
   throw e;
  }finally{try{sql?.close();}catch(_){}loading=false;}
 }
 function layer(pack){
  return L.gridLayer({tileSize:256,minZoom:Math.max(0,Math.min(20,Number(pack.minZoom)||0)),minNativeZoom:Math.max(0,Math.min(20,Number(pack.minZoom)||0)),maxNativeZoom:pack.maxZoom,
   bounds:pack.bounds?[[pack.bounds[1],pack.bounds[0]],[pack.bounds[3],pack.bounds[2]]]:undefined,
   updateWhenIdle:true,updateWhenZooming:false,updateInterval:200,keepBuffer:1,noWrap:true,
   maxZoom:21,attribution:pack.attribution||'Офлайн MBTiles · '+html(pack.name)});
 }
 function buildLayer(pack){
  const grid=layer(pack);
  grid.on('tileunload',e=>{if(e.tile._solinUrl)URL.revokeObjectURL(e.tile._solinUrl);e.tile._solinDisposed=true;});
  grid.createTile=(coords,doneTile)=>{
   const img=document.createElement('img');
   img.alt='';img.setAttribute('role','presentation');
   img.style.width='256px';img.style.height='256px';
   readTile(pack.id,coords.z,coords.x,coords.y).then(blob=>{
    if(img._solinDisposed)return;
    if(!blob){doneTile(null,img);return;}
    const url=URL.createObjectURL(blob);img._solinUrl=url;
    const cleanup=()=>{URL.revokeObjectURL(url);img._solinUrl=null;};
    img.onload=()=>{cleanup();doneTile(null,img);};
    img.onerror=()=>{cleanup();doneTile(Error('Не удалось прочитать офлайн-фрагмент'),img);};
    img.src=url;
   }).catch(err=>doneTile(err,img));
   return img;
  };
  return grid;
 }
 async function select(pack){
  if(!mapRef||pack.forest!==forestId())return;
  restoreEpoch++;
  // Show the installed map at once instead of rebuilding an overview at launch.
  if(pack.forest!==forestId())return;
  if(activeLayer)mapRef.removeLayer(activeLayer);
  activeLayer=buildLayer(pack);activePack=pack;
  window.SolinOfflineImageryActive=pack;
  updateButtons();
 }
 function deactivate(){
  if(activeLayer&&mapRef)mapRef.removeLayer(activeLayer);
  activeLayer=null;activePack=null;
  window.SolinOfflineImageryActive=null;
  updateButtons();
 }
 function hideStored(){
  if(activeLayer&&mapRef?.hasLayer(activeLayer))mapRef.removeLayer(activeLayer);
  updateButtons();
 }
 function updateButtons(mode){
  const offline=document.getElementById('offlineBtn');
  if(offline){offline.disabled=!activePack;offline.classList.toggle('active',mode==='offline');}
 }
 async function showStored(fit=true){
  if(!activePack||!mapRef)return false;
  if(typeof baseGoogle!=='undefined'&&baseGoogle&&mapRef.hasLayer(baseGoogle))mapRef.removeLayer(baseGoogle);
  if(typeof baseOSM!=='undefined'&&baseOSM&&mapRef.hasLayer(baseOSM))mapRef.removeLayer(baseOSM);
  if(!activeLayer)activeLayer=buildLayer(activePack);
  if(!mapRef.hasLayer(activeLayer))activeLayer.addTo(mapRef);
  document.getElementById('satBtn')?.classList.remove('active');
  document.getElementById('osmBtn')?.classList.remove('active');
  updateButtons('offline');
  if(fit&&activePack.bounds){
   const [w,s,e,n]=activePack.bounds;
   if(n>s&&e>w)mapRef.fitBounds([[s,w],[n,e]],{padding:[15,15]});
  }
  return true;
 }
 async function restore(){
  if(!mapRef)return;
  const epoch=++restoreEpoch,forest=forestId();
  deactivate();
  const found=await packs(forest);
  if(epoch!==restoreEpoch||forest!==forestId())return;
  if(found.length){await select(found[0]);await showStored();
   setStatus('Офлайн-снимок готов: '+found[0].name+' ('+found[0].count+' фрагментов).');
  }else{
   if(navigator.onLine!==false&&typeof setBaseMap==='function')setBaseMap('osm');
   setStatus(navigator.onLine===false?'Нет сохранённой карты. Подключитесь к интернету и нажмите «Скачать карту» перед выездом.':'Карта ещё не сохранена. Нажмите «Скачать карту» для работы без интернета.');
  }
 }
 function setStatus(s){
  const el=document.getElementById('offlineImageryStatus');
  if(el)el.textContent=s;
 }
 function attach(map){
  mapRef=map;
  return restore().catch(e=>setStatus('Ошибка офлайн-карты: '+e.message));
 }
 function pick(){
  if(!forestId()){setStatus('Сначала откройте лесничество');return;}
  document.getElementById('offlineImageryInput')?.click();
 }
 function extent(value){
  const a=Array.isArray(value)?value:[value.getWest(),value.getSouth(),value.getEast(),value.getNorth()];
  if(a.length!==4||!a.every(Number.isFinite)||a[0]<-180||a[2]>180||a[1]<-85.05112878||a[3]>85.05112878||a[2]<=a[0]||a[3]<=a[1])
   throw Error('Выберите меньшую область карты без пересечения 180-го меридиана');
  return a;
 }
 function plan(bounds,maxZoom=14){
  const [w,s,e,n]=extent(bounds),max=Number(maxZoom);
  if(!Number.isInteger(max)||max<10||max>SOURCE.maxZoom)throw Error('Масштаб загрузки должен быть от 10 до '+SOURCE.maxZoom);
  const rows=[];
  for(let z=8;z<=max;z++){
   const count=2**z,tx=lon=>Math.max(0,Math.min(count-1,Math.floor((lon+180)/360*count))),
    ty=lat=>Math.max(0,Math.min(count-1,Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*count)));
   const x0=tx(w),x1=tx(e),y0=ty(n),y1=ty(s);
   if(rows.length+(x1-x0+1)*(y1-y0+1)>MAX_DOWNLOAD)throw Error('Область слишком большая. Приблизьте карту или выберите меньшую детализацию (не более '+MAX_DOWNLOAD+' фрагментов)');
   for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)rows.push({z,x,y});
  }
  return rows;
 }
 async function fetchRaster(coords,signal){
  const url=SOURCE.url.replace('{z}',coords.z).replace('{x}',coords.x).replace('{y}',coords.y);
  for(let attempt=0;attempt<3;attempt++){
   const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,20000);
   signal.addEventListener('abort',abort,{once:true});
   try{
    if(signal.aborted)throw Error('Загрузка приостановлена');
    const response=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store'});
    if(!response.ok)throw Error('Сервер карты: '+response.status);
    const bytes=new Uint8Array(await response.arrayBuffer()),mime=tileMime(bytes);
    if(!mime||bytes.length<32||bytes.length>1500000)throw Error('Сервер вернул повреждённый фрагмент');
    return new Blob([bytes],{type:mime});
   }catch(e){if(signal.aborted)throw Error('Загрузка приостановлена');if(attempt===2)throw e;}
   finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }
 }
 async function downloadArea(bounds,maxZoom=14,options={}){
  const forest=forestId();if(!forest)throw Error('Сначала откройте лесничество');
  if(loading)throw Error('Дождитесь завершения текущей загрузки');
  const rows=plan(bounds,maxZoom),area=extent(bounds);
  let pack=options.resumeId?await get('packs',options.resumeId):null;
  if(options.resumeId&&(!pack||pack.forest!==forest||pack.source!==SOURCE.url||JSON.stringify(pack.bounds)!==JSON.stringify(area)||pack.maxZoom!==Number(maxZoom)))throw Error('Параметры пакета не совпадают');
  if(!pack)pack={id:forest+'|download|'+Date.now()+'|'+Math.random().toString(36).slice(2),forest,
   name:'Спутниковая карта · '+new Date().toLocaleDateString('ru-RU'),created:Date.now(),source:SOURCE.url,
   attribution:SOURCE.attribution,bounds:area,minZoom:8,maxZoom:Number(maxZoom),count:0,size:0,total:rows.length};
  loading=true;downloadAbort=new AbortController();const signal=downloadAbort.signal;
  let failed=null,next=0,commitTail=Promise.resolve();
  const commit=(coords,blob)=>{
   const task=commitTail.then(async()=>{
    if(signal.aborted)return;
    if(pack.size+blob.size>MAX_FILE)throw Error('Пакет достиг 350 МБ. Выберите меньшую область');
    const d=await db(),tx=d.transaction(['tiles','packs'],'readwrite');
    const nextPack={...pack,count:pack.count+1,size:pack.size+blob.size};
    tx.objectStore('tiles').put({key:tileId(pack.id,coords.z,coords.x,coords.y),packId:pack.id,blob});
    tx.objectStore('packs').put(nextPack);
    await done(tx);Object.assign(pack,nextPack);progress();
   });
   commitTail=task.catch(()=>{});return task;
  };
  const progress=()=>{
   const message='Сохранено '+pack.count+' из '+pack.total+' фрагментов · '+(pack.size/1024/1024).toFixed(1)+' МБ';
   setStatus(message);options.onProgress?.(message,pack);
  };
  try{
   pack.status='installing';await putPack(pack);progress();
   // Two requests at a time: bound memory usage and public endpoint load.
   async function worker(){
    try{
     while(!signal.aborted&&next<rows.length){
      const coords=rows[next++];
      if(await readTile(pack.id,coords.z,coords.x,coords.y))continue;
      const blob=await fetchRaster(coords,signal);
      if(signal.aborted)break;
      // Commit tile and its package counter in ONE transaction, so a
      // terminated app can resume without losing track of saved tiles.
      await commit(coords,blob);
     }
    }catch(e){if(!failed)failed=e;downloadAbort?.abort();}
   }
   await Promise.all([worker(),worker()]);
   if(failed)throw failed;
   if(signal.aborted||pack.count!==pack.total)throw Error('Загрузка приостановлена');
   // We have already downloaded each level 8..maxZoom; the global overview
   // stays underneath at smaller scales without a costly pyramid rebuild.
   pack.status='ready';await putPack(pack);
   await navigator.storage?.persist?.().catch(()=>false);
   if(forest===forestId()){await select(pack);await showStored(false);}
   setStatus('Карта сохранена полностью: '+pack.count+' фрагментов. Доступна без интернета.');
   return pack;
  }catch(e){
   pack.status='partial';await putPack(pack);
   setStatus('Карта сохранена частично: '+pack.count+' из '+pack.total+'. Нажмите «Скачать карту», чтобы продолжить. '+e.message);
   const error=new Error(e.message);error.offlinePack={...pack};throw error;
  }finally{loading=false;downloadAbort=null;}
 }
 function cancelDownload(){downloadAbort?.abort();}
 function vectorBounds(){
  const result=L.latLngBounds([]);
  if(typeof importedMapLayers!=='undefined')for(const entry of importedMapLayers){
   for(const layer of [entry.layer,...(entry.geometryEntries||[]).map(g=>g.layer)]){
    const b=layer?.getBounds?.();if(b?.isValid())result.extend(b);
   }
  }
  return result.isValid()?extent(result):null;
 }
 async function openDownload(){
  if(!forestId()||!mapRef){window.toast?.('Сначала откройте карту лесничества');return;}
  if(loading){window.toast?.('Карта загружается. Дождитесь завершения');return;}
  const visible=extent(mapRef.getBounds()),vectors=vectorBounds(),saved=await packs(forestId(),true);
  openModal('Карта без интернета','<p>Выберите область и скачайте её перед выездом. Карта останется на планшете после закрытия приложения.</p>'+
   '<label>Область<select id="mapDownloadArea">'+(vectors?'<option value="vectors">Вся открытая карта с контурами</option>':'')+'<option value="screen">Область на экране</option></select></label>'+
   '<label>Детализация<select id="mapDownloadZoom"><option value="14">Подробная · снимок 10 м</option><option value="13">Средняя</option><option value="12">Обзорная</option></select></label>'+
   '<p>Источник: Sentinel-2, съёмка 2016–2017. Для более свежих снимков можно импортировать свой MBTiles.</p>'+
   '<p id="mapDownloadEstimate" role="status"></p><p id="mapDownloadProgress" role="status"></p>'+
   '<div class="formActions"><button type="button" id="mapDownloadStart" class="primary">Скачать</button><button type="button" id="mapDownloadCancel">Закрыть</button></div>'+
   '<div id="mapDownloadedPackages">'+saved.map((p,i)=>'<p>'+html(p.name)+' · '+p.count+(p.total?' / '+p.total:'')+' фрагментов'+(p.status==='ready'?' · готово':' · не завершено')+
    (p.status!=='ready'&&p.source===SOURCE.url?' <button type="button" data-resume-map="'+i+'">Продолжить</button>':'')+'</p>').join('')+'</div>');
  const start=document.getElementById('mapDownloadStart'),cancel=document.getElementById('mapDownloadCancel'),
   area=document.getElementById('mapDownloadArea'),zoom=document.getElementById('mapDownloadZoom'),estimate=document.getElementById('mapDownloadEstimate'),progress=document.getElementById('mapDownloadProgress');
  const chosen=()=>area.value==='vectors'?vectors:visible;
  const update=()=>{try{const count=plan(chosen(),Number(zoom.value)).length;estimate.textContent=count+' фрагментов · ориентировочно '+Math.ceil(count*35/1024)+' МБ';start.disabled=false;}catch(e){estimate.textContent=e.message;start.disabled=true;}};
  area.onchange=zoom.onchange=update;update();
  const run=async pack=>{
   start.disabled=true;area.disabled=true;zoom.disabled=true;cancel.textContent='Приостановить';
   document.querySelectorAll('[data-resume-map]').forEach(b=>b.disabled=true);
   try{
    await downloadArea(pack?.bounds||chosen(),pack?.maxZoom||Number(zoom.value),{resumeId:pack?.id,onProgress:message=>progress.textContent=message});
    progress.textContent='Готово. Карта полностью сохранена и работает без интернета.';cancel.textContent='Закрыть';
   }catch(e){
    progress.textContent=e.message+'. Сохранённую часть можно продолжить из этого окна.';cancel.textContent='Закрыть';start.disabled=false;
    if(e.offlinePack){start.textContent='Продолжить';start.onclick=()=>run(e.offlinePack);}
   }
   finally{area.disabled=false;zoom.disabled=false;cancel.disabled=false;}
  };
  start.onclick=()=>run();
  cancel.onclick=()=>{if(loading){cancelDownload();cancel.disabled=true;}else closeModal();};
  for(const b of document.querySelectorAll('[data-resume-map]'))b.onclick=()=>run(saved[Number(b.dataset.resumeMap)]);
 }
 function setup(){
  const input=document.getElementById('offlineImageryInput');
  if(input)input.addEventListener('change',async()=>{
   const f=input.files?.[0];input.value='';if(!f)return;
   try{await importFile(f);}catch(e){window.toast?.(e.message);}
  });
  window.addEventListener('solin-forest-changed',()=>{
   cancelDownload();
   restore().catch(e=>setStatus('Офлайн-карта: '+e.message));
  });
  window.addEventListener('offline',()=>{if(activePack)void showStored(false);});
 }
 window.SolinOfflineImagery={attach,restore,importFile,readTile,packs,remove,
  show:showStored,hide:hideStored,pick,openDownload,downloadArea,cancelDownload,plan,
  ensurePyramid,get cacheStats(){return {tiles:rasterCache.size,bytes:cacheBytes};},
  get active(){return activePack;}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})();
