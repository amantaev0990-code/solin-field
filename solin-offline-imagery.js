/* SOLI-N Field: CarryMap-style offline raster packages.
 * Store user-owned/licensed MBTiles in IndexedDB as raster tiles, separated
 * by forestry workspace; do not cache Google/OSM imagery without permission.
 * Original MDB and card data are never touched by this module. */
(()=>{'use strict';
 const DB_NAME='SOLIN_FIELD_OFFLINE_IMAGERY_V1',VERSION=1;
 const MAX_FILE=350*1024*1024,MAX_TILES=25000,CHUNK=80;
 let dbPromise=null,activeLayer=null,activePack=null,mapRef=null,loading=false;
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
 async function packs(forest=forestId()){
  if(!forest)return [];
  const d=await db();
  return new Promise((resolve,reject)=>{
   const req=d.transaction('packs','readonly').objectStore('packs').getAll();
   req.onsuccess=()=>resolve((req.result||[]).filter(x=>x.forest===forest&&x.status==='ready').sort((a,b)=>b.created-a.created));
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
 async function readTile(id,z,x,y){return (await get('tiles',tileId(id,z,x,y)))?.blob||null;}
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
   pack.status='ready';await putPack(pack);
   await navigator.storage?.persist?.().catch(()=>false);
   await select(pack);
   await showStored();
   setStatus('Офлайн-снимок сохранён для лесничества: '+pack.count+' фрагментов, масштабы '+pack.minZoom+'–'+pack.maxZoom);
   return pack;
  }catch(e){
   try{await remove(pack.id);}catch(_){}
   setStatus('Не удалось сохранить снимок: '+e.message);
   throw e;
  }finally{try{sql?.close();}catch(_){}loading=false;}
 }
 function layer(pack){
  return L.gridLayer({tileSize:256,minZoom:pack.minZoom,maxNativeZoom:pack.maxZoom,
   maxZoom:21,attribution:'Офлайн MBTiles · '+html(pack.name)});
 }
 function buildLayer(pack){
  const grid=layer(pack);
  grid.createTile=(coords,doneTile)=>{
   const img=document.createElement('img');
   img.alt='';img.setAttribute('role','presentation');
   img.style.width='256px';img.style.height='256px';
   readTile(pack.id,coords.z,coords.x,coords.y).then(blob=>{
    if(!blob){doneTile(null,img);return;}
    const url=URL.createObjectURL(blob);
    const cleanup=()=>URL.revokeObjectURL(url);
    img.onload=()=>{cleanup();doneTile(null,img);};
    img.onerror=()=>{cleanup();doneTile(Error('Не удалось прочитать офлайн-фрагмент'),img);};
    img.src=url;
   }).catch(err=>doneTile(err,img));
   return img;
  };
  return grid;
 }
 async function select(pack){
  if(!mapRef)return;
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
 async function showStored(){
  if(!activePack||!mapRef)return false;
  if(typeof baseGoogle!=='undefined'&&baseGoogle&&mapRef.hasLayer(baseGoogle))mapRef.removeLayer(baseGoogle);
  if(typeof baseOSM!=='undefined'&&baseOSM&&mapRef.hasLayer(baseOSM))mapRef.removeLayer(baseOSM);
  if(!activeLayer)activeLayer=buildLayer(activePack);
  if(!mapRef.hasLayer(activeLayer))activeLayer.addTo(mapRef);
  document.getElementById('satBtn')?.classList.remove('active');
  document.getElementById('osmBtn')?.classList.remove('active');
  updateButtons('offline');
  if(activePack.bounds){
   const [w,s,e,n]=activePack.bounds;
   if(n>s&&e>w)mapRef.fitBounds([[s,w],[n,e]],{padding:[15,15]});
  }
  return true;
 }
 async function restore(){
  if(!mapRef)return;
  deactivate();
  const found=await packs();
  if(found.length){await select(found[0]);await showStored();
   setStatus('Офлайн-снимок готов: '+found[0].name+' ('+found[0].count+' фрагментов).');
  }else{
   setStatus('Нет сохранённого спутникового пакета. Импортируйте MBTiles для этого лесничества.');
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
 function setup(){
  const input=document.getElementById('offlineImageryInput');
  if(input)input.addEventListener('change',async()=>{
   const f=input.files?.[0];input.value='';if(!f)return;
   try{await importFile(f);}catch(e){window.toast?.(e.message);}
  });
  window.addEventListener('solin-forest-changed',()=>{
   restore().catch(e=>setStatus('Офлайн-карта: '+e.message));
  });
 }
 window.SolinOfflineImagery={attach,restore,importFile,readTile,packs,remove,
  show:showStored,hide:hideStored,pick,get active(){return activePack;}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})();
