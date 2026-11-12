let fieldMap=null,baseGoogle=null,baseOSM=null,userMarker=null;
const cmf2Layers=[];
const importedMapLayers=window.importedMapLayers=[];
function cmfTypeLabel(t){return({region:'полигон',polyline:'линия',text:'текст',point:'точка'})[t]||t||'слой'}
function renderSourceMapLayerList(){const box=document.getElementById('mapLayerList');if(!box)return;if(!importedMapLayers.length){box.innerHTML='<div class="mapLayerRow"><span>＋</span><span>Откройте карту<small>ZIP MapInfo · CMF2 · KML/KMZ · GeoJSON · GeoPackage · GPX</small></span></div>';return}box.innerHTML=importedMapLayers.map((x,i)=>{if(x.cmf2){const info=x.info||{},layers=info.layers||[],decoded=new Map((x.geometryEntries||[]).map(g=>[g.source,g]));const head=`<div class="mapLayerRow"><span>◈</span><span><b>${escapeMapHtml(x.name)}</b><small>CMF2 · ${info.decodedFeatures||0} объектов · ${info.decodedVertices||0} вершин${info.zone?` · UTM ${info.zone}`:''}</small></span></div>`;const rows=layers.map(l=>{const g=decoded.get(l.source);if(g)return `<label class="mapLayerRow cmfSubLayer"><input type="checkbox" ${g.visible?'checked':''} onchange="toggleCmfLayer(${i},${escapeMapHtml(JSON.stringify(String(l.source)))},this.checked)"><span>${l.type==='region'?'⬠':'╱'}</span><span>${escapeMapHtml(l.name||l.source)}<small>${g.count} объектов · ${cmfTypeLabel(l.type)}</small></span></label>`;return `<div class="mapLayerRow cmfSubLayer"><span>${l.type==='text'?'T':'•'}</span><span>${escapeMapHtml(l.name||l.source)}<small>${cmfTypeLabel(l.type)} · геометрия пока не декодируется</small></span></div>`}).join('');return head+rows}return `<label class="mapLayerRow"><input type="checkbox" ${x.visible?'checked':''} onchange="toggleImportedLayer(${i},this.checked)"><span>${escapeMapHtml(x.name)}<small>${x.count} объектов${x.format?` · ${x.format}`:''}</small></span></label>`}).join('')}
function renderMapLayerList(){
 renderSourceMapLayerList();
 const list=document.getElementById('mapLayerList');
 const objects=window.SolinMapObjects;
 if(!list||!objects)return;
 const row=document.createElement('label');
 row.className='mapLayerRow';
 const toggle=document.createElement('input');
 toggle.type='checkbox';
 toggle.checked=objects.visible();
 toggle.setAttribute('aria-label','Значения');
 toggle.onchange=()=>objects.setVisible(toggle.checked);
 const title=document.createElement('span');
 title.textContent='Значения';
 const info=document.createElement('small');
 const prefix=importedMapLayers.find(layer=>layer.format==='MapInfo')?.name.match(/^\d+_\d+_/i)?.[0]||'';
 info.textContent=prefix+'ЗНАЧ · '+objects.count()+' объектов';
 title.append(info);
 row.append(toggle,title);
 list.append(row);
}
function ensureMapFileUi(){
 if(document.getElementById('mapFileInput'))return;
 const toolbar=document.querySelector('#mapScreen .mapToolbar');
 const button=document.createElement('button');
 button.type='button';button.className='mapMode';button.textContent='Открыть файл карты';
 button.onclick=openMapFilePicker;
 toolbar?.prepend(button);
 const input=document.createElement('input');
 input.id='mapFileInput';input.type='file';input.multiple=true;input.hidden=true;
 input.accept='.cmf2,.kmf2,.cmf,.kmf,.kml,.kmz,.geojson,.json,.gpx,.gpkg,.zip';
 input.onchange=()=>window.handleMapFiles(input);
 document.body.appendChild(input);
}
let onlineBase='osm',baseWait=null;
const overviewMessage='Показана обзорная карта. Подробности доступны из сохранённого снимка или файла карты.';
function showMapNetworkStatus(message){
 const status=document.getElementById('mapNetworkStatus');
 if(status)status.textContent=message;
}
function resetMapNetworkStatus(){
 clearTimeout(baseWait);
 showMapNetworkStatus('');
}
function watchBaseTiles(layer){
 let loaded=false;
 layer.on('loading',()=>{
  if(!fieldMap.hasLayer(layer))return;
  loaded=false;
  resetMapNetworkStatus();
  baseWait=setTimeout(()=>{
   if(fieldMap.hasLayer(layer)&&!loaded)showMapNetworkStatus(overviewMessage);
  },8000);
 });
 layer.on('tileload',()=>{
  if(!fieldMap.hasLayer(layer))return;
  loaded=true;
  resetMapNetworkStatus();
 });
 layer.on('load',()=>{
  if(!fieldMap.hasLayer(layer))return;
  resetMapNetworkStatus();
  if(!loaded)showMapNetworkStatus(overviewMessage);
 });
}
async function loadMapOverview(map){
 const response=await fetch('./solin-map-overview.geojson');
 if(!response.ok)throw Error('Обзорная карта не загрузилась');
 const geo=await response.json();
 L.geoJSON(geo,{pane:'fieldOverview',interactive:false,style:feature=>({
  color:'#6d8d7b',weight:1,fillColor:feature.properties.code==='KAZ'?'#dce7cf':'#e8e9db',fillOpacity:1
 })}).addTo(map);
 map.attributionControl.addAttribution('Обзор: Natural Earth');
}
function initFieldMap(){
 if(fieldMap)return fieldMap;
 const container=document.getElementById('fieldMap');
 if(!container||!window.L){
  showMapNetworkStatus('Модуль карты не загрузился. Откройте раздел ещё раз.');
  return null;
 }
 ensureMapFileUi();
 fieldMap=window.fieldMap=L.map(container,{
  zoomControl:true,preferCanvas:true,zoomAnimation:true,fadeAnimation:false,markerZoomAnimation:false
 });
 fieldMap.createPane('fieldOverview').style.zIndex='190';
 fieldMap.setView([48.4,66.8],5);
 const tileOptions={updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,maxZoom:21,maxNativeZoom:19};
 baseGoogle=L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
  ...tileOptions,subdomains:['mt0','mt1','mt2','mt3'],attribution:'Спутниковые снимки Google'
 });
 baseOSM=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  ...tileOptions,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
 });
 watchBaseTiles(baseGoogle);
 watchBaseTiles(baseOSM);
 setBaseMap(onlineBase);
 installFieldMapTools(fieldMap);
 const labels = () => container.classList.toggle('mapinfo-hide-labels', fieldMap.getZoom() < 11);
 fieldMap.on('zoomend', labels);
 labels();
 renderMapLayerList();
 void loadMapOverview(fieldMap).catch(error=>console.warn(error.message));
 void window.SolinOfflineImagery?.attach?.(fieldMap);
 return fieldMap;
}
function openMapScreen(){
 show('mapScreen');
 const map=initFieldMap();
 if(!map)return false;
 requestAnimationFrame(()=>map.invalidateSize({pan:false}));
 return true;
}
function setBaseMap(kind=onlineBase){
 if(kind!=='google'&&kind!=='osm')return;
 onlineBase=kind;
 if(!fieldMap){initFieldMap();return;}
 const map=fieldMap;
 window.SolinOfflineImagery?.hide?.();
 resetMapNetworkStatus();
 const selected=kind==='google'?baseGoogle:baseOSM;
 for(const layer of [baseGoogle,baseOSM]){
  if((layer!==selected||navigator.onLine===false)&&map.hasLayer(layer))map.removeLayer(layer);
 }
 if(navigator.onLine===false)showMapNetworkStatus(overviewMessage);
 else if(!map.hasLayer(selected))selected.addTo(map);
 document.getElementById('satBtn')?.classList.toggle('active',kind==='google');
 document.getElementById('osmBtn')?.classList.toggle('active',kind==='osm');
}
for(const event of ['online','offline']){
 window.addEventListener(event,()=>{
  const open=document.getElementById('mapScreen')?.classList.contains('active');
  const saved=document.getElementById('offlineBtn')?.classList.contains('active');
  if(open&&!saved)setBaseMap();
 });
}
function toggleMapLayers(){
 const panel=document.getElementById('mapLayerPanel');
 if(!panel)return;
 const hidden=panel.classList.toggle('hiddenPanel');
 document.getElementById('mapLayersButton')?.setAttribute('aria-expanded',String(!hidden));
}
let stopMapGps=null,userAccuracy=null;
function mapLocateMe(){
 if(!initFieldMap())return;
 const button=document.getElementById('mapGpsBtn'),status=document.getElementById('mapGpsStatus');
 const showStatus=message=>{if(status)status.textContent=message;};
 if(stopMapGps){stopMapGps();stopMapGps=null;button?.classList.remove('active');showStatus('GPS остановлен');return;}
 button?.classList.add('active');showStatus('Ищу спутники GPS… Первый сигнал может занять до минуты.');
 let first=true,failed=false;
 const stop=window.SolinLocation.watch(p=>{
  const ll=[p.coords.latitude,p.coords.longitude],acc=p.coords.accuracy;
  gps={lat:ll[0],lon:ll[1],acc};
  if(userMarker)userMarker.setLatLng(ll);
  else userMarker=L.circleMarker(ll,{radius:9,weight:3,color:'#fff',fillColor:'#147ce5',fillOpacity:1}).addTo(fieldMap);
  userMarker.bindPopup('Моё местоположение'+(Number.isFinite(acc)?' · ±'+Math.round(acc)+' м':''));
  if(Number.isFinite(acc)){
   if(userAccuracy)userAccuracy.setLatLng(ll).setRadius(acc);
   else userAccuracy=L.circle(ll,{radius:acc,color:'#147ce5',weight:1,fillOpacity:.1,interactive:false}).addTo(fieldMap);
  }
  if(first){fieldMap.setView(ll,Math.max(fieldMap.getZoom(),16));first=false;}
  showStatus('GPS: '+ll[0].toFixed(6)+', '+ll[1].toFixed(6)+(Number.isFinite(acc)?' · точность ±'+Math.round(acc)+' м':''));
 },error=>{failed=true;stopMapGps?.();stopMapGps=null;button?.classList.remove('active');showStatus(error.message);toast(error.message);});
 if(!failed)stopMapGps=stop;
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden&&stopMapGps){stopMapGps();stopMapGps=null;document.getElementById('mapGpsBtn')?.classList.remove('active');
  const status=document.getElementById('mapGpsStatus');if(status)status.textContent='GPS приостановлен. Нажмите «GPS» для продолжения.';}
});
function openMapFilePicker(){document.getElementById('mapFileInput')?.click()}
function mapFileKey(file){return [file.name,file.size,file.lastModified].join('|')}
function makeGeoGroup(geo){return L.geoJSON(geo,{smoothFactor:2.5,style:styleImportedFeature,pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:5,weight:2,fillOpacity:.8}),onEachFeature:bindImportedFeature}).addTo(fieldMap)}
function addGeoLayer(name,geo,key,format){if(!geo||geo.type!=='FeatureCollection')throw new Error('Нет векторных объектов');const group=makeGeoGroup(geo);const entry={key,name,layer:group,count:(geo.features||[]).length,visible:true,format};importedMapLayers.push(entry);return entry}
async function handleMapFiles(input){
 const files=Array.from(input?.files||[]);
 const accepted=new Set();
 if(!files.length||!initFieldMap())return accepted;
 const bounds=L.latLngBounds([]);
 let added=0;
 for(const file of files){
  const key=mapFileKey(file);
  if(importedMapLayers.some(entry=>entry.fileKey===key||entry.key===key)){
   accepted.add(key);
   continue;
  }
  try{
   const detected=await window.SolinMapImport?.detect(file);
   if (detected === 'zip') {
    setMapImportStatus('Открываю ZIP MapInfo: ' + file.name);
    const layers = await readMapInfoZip(file);
    const entries = layers.map((layer, index) => createMapInfoLayer(layer, key, index, layers.length));
    for (const entry of entries) {
     if (entry.visible) entry.layer.addTo(fieldMap);
     importedMapLayers.push(entry);
     bounds.extend(entry.bounds);
     added += entry.count;
    }
    accepted.add(key);
    setMapImportStatus('ZIP MapInfo открыт: ' + layers.length + ' слоёв');
    continue;
   }
   if(detected==='cmf2'){
    const info=await inspectCmf2(file);
    const entry={key,fileKey:key,name:file.name,cmf2:true,count:info.decodedFeatures||0,
     projection:info.projection,visible:true,info,geometryEntries:[]};
    for(const geometry of info.geometryLayers||[]){
     const group=makeGeoGroup(geometry.geojson);
     entry.geometryEntries.push({source:geometry.source,name:geometry.name,type:geometry.type,
      count:geometry.count,layer:group,visible:true});
     if(group.getBounds().isValid())bounds.extend(group.getBounds());
     added+=geometry.count;
    }
    if(!entry.geometryEntries.length&&info.extent?.wgs84){
     const e=info.extent.wgs84;
     entry.layer=L.rectangle([[e.south,e.west],[e.north,e.east]],{
      weight:2,fillOpacity:0,dashArray:'7 6',interactive:false
     }).addTo(fieldMap);
     bounds.extend(entry.layer.getBounds());
    }
    importedMapLayers.push(entry);
    if(!entry.geometryEntries.length)toast('В '+file.name+' геометрия CMF2 не распознана');
   }else{
    const layers=detected==='gpkg'?(await openGeoPackageFile(file)).layers:
     [{name:file.name,geojson:await mapGeoJson(file,detected)}];
    if(!layers.length)throw Error('В файле нет векторных слоёв');
    for(const layer of layers){
     const name=detected==='gpkg'?file.name+' › '+layer.name:layer.name;
     const entry=addGeoLayer(name,layer.geojson,key+'|'+layer.name,detected.toUpperCase());
     entry.fileKey=key;
     const extent=entry.layer.getBounds();
     if(extent.isValid())bounds.extend(extent);
     added+=entry.count;
    }
   }
   accepted.add(key);
  }catch(error){
   console.warn(error);
   if (/\.zip$/i.test(file.name)) setMapImportStatus('Ошибка ZIP MapInfo: ' + (error.message || String(error)));
   toast(file.name+': '+(error.message||'не удалось открыть'));
  }
 }
 renderMapLayerList();
 if(bounds.isValid())fieldMap.fitBounds(bounds,{padding:[18,18],maxZoom:18});
 if(added)toast('Открыто объектов: '+added);
 if(input)input.value='';
 return accepted;
}
async function mapGeoJson(file,format){
 if(format==='kmz')return kmlToGeoJSON(await SolinMapImport.kmzToKml(file));
 if(format==='kml')return kmlToGeoJSON(await file.text());
 if(format==='gpx')return SolinMapImport.gpxToGeoJSON(await file.text());
 if(format!=='geojson')throw Error('Формат файла карты не распознан');
 const geo=JSON.parse(await file.text());
 if(geo?.type==='FeatureCollection'&&Array.isArray(geo.features))return geo;
 if(geo?.type==='Feature')return {type:'FeatureCollection',features:[geo]};
 if(['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon','GeometryCollection'].includes(geo?.type)){
  return {type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:geo}]};
 }
 throw Error('Некорректная структура GeoJSON');
}
function toggleImportedLayer(index,on){const x=importedMapLayers[index];if(!x||!fieldMap||x.cmf2)return;x.visible=on;if(on){if(!fieldMap.hasLayer(x.layer))x.layer.addTo(fieldMap)}else if(fieldMap.hasLayer(x.layer))fieldMap.removeLayer(x.layer)}
function toggleCmfLayer(index,source,on){const x=importedMapLayers[index],g=x?.geometryEntries?.find(v=>v.source===source);if(!g||!fieldMap)return;g.visible=on;if(on){if(!fieldMap.hasLayer(g.layer))g.layer.addTo(fieldMap)}else if(fieldMap.hasLayer(g.layer))fieldMap.removeLayer(g.layer)}
function styleImportedFeature(f){const t=f?.geometry?.type||'',p=f?.properties||{};if(t.includes('Line'))return{weight:p.CMF_LAYER?2:3,opacity:.95};if(t.includes('Polygon'))return{weight:2,fillOpacity:String(p.CMF_LAYER??'').includes('ВыдПород')?0.12:0.18};return{weight:2,fillOpacity:.8}}
function bindImportedFeature(feature,layer){layer.on('click',e=>{if(typeof showCmfSheet==='function')showCmfSheet(feature,e.latlng,layer);else{const p=feature?.properties||{};layer.bindPopup(Object.entries(p).slice(0,20).map(([k,v])=>`<b>${escapeMapHtml(k)}</b>: ${escapeMapHtml(v)}`).join('<br>')||'Объект').openPopup()}})}
function escapeMapHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function kmlToGeoJSON(text){const xml=new DOMParser().parseFromString(text,'text/xml');if(xml.querySelector('parsererror'))throw new Error('Повреждённый KML');const features=[];xml.querySelectorAll('Placemark').forEach(pm=>{const props={};const name=pm.querySelector(':scope > name')?.textContent?.trim();if(name)props.name=name;pm.querySelectorAll('ExtendedData Data').forEach(d=>{const k=d.getAttribute('name'),v=d.querySelector('value')?.textContent?.trim();if(k)props[k]=v??''});pm.querySelectorAll('ExtendedData SimpleData').forEach(d=>{const k=d.getAttribute('name');if(k)props[k]=d.textContent?.trim()||''});const geoms=[];pm.querySelectorAll('Point,LineString,Polygon').forEach(el=>{if(el.closest('Placemark')===pm){const g=kmlGeometry(el);if(g)geoms.push(g)}});if(geoms.length)features.push({type:'Feature',properties:props,geometry:geoms.length===1?geoms[0]:{type:'GeometryCollection',geometries:geoms}})});return{type:'FeatureCollection',features}}
function kmlGeometry(el){const tag=el.localName;if(tag==='Point'){const c=parseKmlCoords(el.querySelector('coordinates')?.textContent);return c.length?{type:'Point',coordinates:c[0]}:null}if(tag==='LineString'){const c=parseKmlCoords(el.querySelector('coordinates')?.textContent);return c.length>1?{type:'LineString',coordinates:c}:null}if(tag==='Polygon'){const rings=[];el.querySelectorAll('outerBoundaryIs LinearRing coordinates, innerBoundaryIs LinearRing coordinates').forEach(n=>{const c=parseKmlCoords(n.textContent);if(c.length>2)rings.push(c)});return rings.length?{type:'Polygon',coordinates:rings}:null}return null}
function parseKmlCoords(s){return String(s||'').trim().split(/\s+/).map(x=>x.split(',').slice(0,3).map(Number)).filter(a=>a.length>=2&&Number.isFinite(a[0])&&Number.isFinite(a[1]))}

function fieldAreaHectares(points) {
 const radians = Math.PI / 180;
 let sum = 0;
 for (let i = 0; i < points.length; i++) {
  const a = points[i], b = points[(i + 1) % points.length];
  const longitude = ((b.lng - a.lng + 540) % 360 - 180) * radians;
  sum += longitude * (Math.sin(a.lat * radians) + Math.sin(b.lat * radians));
 }
 return Math.abs(sum) * 6371008.8 ** 2 / 20000;
}

function installFieldMapTools(map) {
 const legacyKey = 'solin.field.map-marks.v1';
 const db = new Promise((resolve, reject) => {
  const request = indexedDB.open('solin-field-map-objects', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('layers');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
 });
 // The shared legacy map shows existing V43–V48 marks after upgrading.
 const shared = 'legacy';
 let scope = shared, features = [], loaded = false, mode = '', points = [], tracking = null;
 let busy = false;
 const saved = L.layerGroup().addTo(map);
 const preview = L.layerGroup().addTo(map);
 const style = {color:'#ec8515',weight:4};
 const tools = L.control({position:'bottomleft'});
 const areaBadge=document.createElement('output');
 areaBadge.className='field-map-area';
 areaBadge.hidden=true;
 areaBadge.setAttribute('aria-label','Площадь, гектары');
 map.getContainer().append(areaBadge);
 L.DomEvent.disableClickPropagation(areaBadge);
 const status = document.createElement('output');
 const buttons = new Map();
 const minimum = kind => ({mark:1,line:2,area:3,track:2})[kind] || Infinity;
 const position = point => [point.lat, point.lng];
 const hectares = () => fieldAreaHectares(points).toLocaleString('ru-RU',{maximumFractionDigits:3}) + ' га';
 const canDraw=()=>scope!==shared&&map.hasLayer(saved);
 const areaHandleIcon=L.divIcon({className:'field-area-handle',iconSize:[24,24],iconAnchor:[12,12]});
 function showArea(){
  areaBadge.hidden=mode!=='area';
  areaBadge.textContent=points.length>=3?hectares():'— га';
 }

 function access(key, value) {
  return db.then(database => new Promise((resolve, reject) => {
   const writing = value !== undefined;
   const tx = database.transaction('layers', writing ? 'readwrite' : 'readonly');
   const store = tx.objectStore('layers');
   const request = writing ? store.put(value,key) : store.get(key);
   tx.oncomplete = () => resolve(request.result);
   tx.onabort = () => reject(tx.error);
  }));
 }
 function stopTrack() {
  if (tracking != null) navigator.geolocation.clearWatch(tracking);
  tracking = null;
 }
 function reset() {
  stopTrack();
  mode = '';
  points = [];
  redraw();
 }
 function redraw() {
  map.getContainer().dataset.mapTool = mode;
  for (const [key,button] of buttons) {
   if (['mark','line','area','track','ruler'].includes(key)) {
    button.setAttribute('aria-pressed', String(key === mode));
    button.disabled = !loaded || busy || (key!=='ruler'&&!canDraw()) || (key !== mode && !!mode);
   }
  }
  buttons.get('undo').disabled = !points.length || mode === 'track' || busy;
  buttons.get('save').disabled = points.length < minimum(mode) || busy;
  buttons.get('cancel').disabled = !mode || busy;
  preview.clearLayers();
  if(mode==='area'){
   const outline=L.polygon(points,{...style,interactive:false}).addTo(preview);
   points.forEach((point,index)=>{
    const vertex=L.marker(point,{icon:areaHandleIcon,draggable:true,bubblingMouseEvents:false,
     alt:'Вершина '+(index+1)+'. Нажмите, чтобы удалить, или перетащите.'}).addTo(preview);
    vertex.on('click',event=>{
     L.DomEvent.stopPropagation(event);
     points.splice(index,1);
     redraw();
    });
    vertex.on('drag',()=>{
     points[index]=vertex.getLatLng().wrap();
     outline.setLatLngs(points);
     showArea();
    });
   });
  }else{
   if(points.length>=2)L.polyline(points,{...style,interactive:false}).addTo(preview);
   if(mode!=='track')for(const point of points)L.circleMarker(point,{...style,radius:4,interactive:false}).addTo(preview);
  }
  showArea();
  const distance = () => points.slice(1).reduce((sum,point,i) => sum + map.distance(points[i],point),0);
  status.textContent = {
   mark:'Коснитесь места для метки',
   line:points.length + ' точек · касайтесь карты',
   area:points.length < 3 ? 'Поставьте минимум три точки' : 'Коснитесь вершины для удаления. Потяните её для переноса.',
   track:'Запись GPS · ' + points.length + ' точек',
   ruler:points.length ? Math.round(distance()) + ' м' : 'Поставьте начальную точку'
  }[mode] || '';
 }
 async function write(next) {
  if (!loaded || busy) return false;
  const key = scope;
  busy = true;
  try {
   await access(key,next);
   if (scope === key) {
    features = next;
    drawSaved();
   }
   return true;
  } catch (error) {
   toast('Не удалось сохранить полевой слой: ' + error.message);
   return false;
  } finally {
   busy = false;
   redraw();
  }
 }
 function drawSaved() {
  saved.clearLayers();
  renderMapLayerList();
  for (const feature of features) {
   const popup = document.createElement('div');
   const title = document.createElement('div');
   title.textContent = feature.name + (feature.kind === 'area' ?
    ' · ' + fieldAreaHectares(feature.points.map(([lat,lng])=>({lat,lng}))).toFixed(3) + ' га' : '');
   const remove = document.createElement('button');
   remove.type = 'button';
   remove.textContent = 'Удалить';
   remove.onclick = () => { void write(features.filter(item => item !== feature)); };
   popup.append(title, remove);
   const shape = feature.kind === 'mark' ?
    L.circleMarker(feature.points[0],{...style,radius:7,fillOpacity:1,bubblingMouseEvents:false}) :
    (feature.kind === 'area' ? L.polygon : L.polyline)(feature.points,
     {...style,color:feature.kind === 'track' ? '#a221d2' : style.color,bubblingMouseEvents:false});
   shape.bindPopup(popup).addTo(saved);
  }
 }
 let loadGeneration = 0;
 async function open(key = shared) {
  const generation = ++loadGeneration;
  scope = key;
  loaded = false;
  saved.clearLayers();
  reset();
  try {
   let rows = await access(key);
   if (rows === undefined && key === shared) {
    const legacy = JSON.parse(localStorage.getItem(legacyKey) || '[]');
    if (Array.isArray(legacy)) rows = legacy.filter(item => item && Number.isFinite(item.lat) &&
     Number.isFinite(item.lng) && typeof item.name === 'string').map(item =>
      ({kind:'mark',name:item.name,points:[[item.lat,item.lng]]}));
   }
   if (generation !== loadGeneration) return;
   features = Array.isArray(rows) ? rows : [];
   loaded = true;
   drawSaved();
   redraw();
  } catch (error) {
   if (generation === loadGeneration) toast('Не удалось прочитать полевой слой: ' + error.message);
  }
 }
 function start(kind) {
  if (!loaded || busy || (kind!=='ruler'&&!canDraw()) || (mode && mode !== kind)) return;
  if (mode === kind) return;
  if (kind === 'track' && !navigator.geolocation) return toast('GPS недоступен');
  mode = kind;
  if (kind === 'track') tracking = navigator.geolocation.watchPosition(result => {
   if (mode !== 'track' || busy) return;
   const {latitude:lat,longitude:lng,accuracy} = result.coords;
   if (!Number.isFinite(lat) || !Number.isFinite(lng) || accuracy > 75) return;
   const point = L.latLng(lat,lng), last = points.at(-1);
   if (last && map.distance(last,point) < 3) return;
   points.push(point);
   redraw();
  }, error => {
   toast('GPS: ' + error.message);
   if (error.code === 1) reset();
  }, {enableHighAccuracy:true,maximumAge:3000,timeout:15000});
  redraw();
 }
 async function saveShape() {
  if (busy || !canDraw() || points.length < minimum(mode)) return;
  const kind = mode;
  const fallback = {mark:'Метка',line:'Линия',area:'Площадь',track:'GPS-трек'}[kind];
  const name = window.prompt('Название объекта', fallback);
  if (name == null) return;
  const generation = loadGeneration;
  const feature = {kind,name:name.trim().slice(0,120)||fallback,points:points.map(position)};
  if (await write([...features,feature]) && generation === loadGeneration) reset();
 }
 tools.onAdd = () => {
  const panel = L.DomUtil.create('details','leaflet-bar field-map-tools');
  const summary = document.createElement('summary');
  summary.textContent = 'Инструменты карты';
  panel.append(summary);
  const grid = document.createElement('div');
  grid.className = 'field-map-tool-buttons';
  const add = (key,label,action) => {
   const button = document.createElement('button');
   button.type = 'button';
   button.textContent = label;
   button.onclick = action;
   buttons.set(key,button);
   grid.append(button);
  };
  for (const [key,label] of Object.entries({mark:'Метка',line:'Линия',area:'Площадь',track:'GPS-трекер',ruler:'Линейка'})) {
   add(key,label,() => start(key));
  }
  add('offline-import','Импорт офлайн-карты',() => window.SolinOfflineImagery?.pick?.());
  add('undo','Убрать точку',() => { points.pop(); redraw(); });
  add('save','Сохранить',() => { void saveShape(); });
  add('cancel','Отмена',reset);
  status.setAttribute('aria-live','polite');
  panel.append(grid,status);
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);
  return panel;
 };
 tools.addTo(map);
 map.on('click', ({latlng}) => {
  if (!mode || mode === 'track' || busy) return;
  if (mode === 'mark') points = [latlng.wrap()];
  else points.push(latlng.wrap());
  redraw();
  if (mode === 'mark') void saveShape();
 });
 window.SolinMapObjects = {
  open,
  visible:()=>map.hasLayer(saved),
  count:()=>features.length,
  setVisible(visible){
   if(visible)map.addLayer(saved);
   else{
    map.removeLayer(saved);
    if(mode!=='ruler')reset();
   }
   redraw();
  }
 };
 void open();
}

let mapInfoPaneId = 0;
function createMapInfoLayer({name, geojson, settings}, fileKey, index, count) {
 const pane = 'mapinfo-' + (++mapInfoPaneId);
 fieldMap.createPane(pane).style.zIndex = String(410 + (count - index) / count * 80 | 0);
 const renderer = L.canvas({pane, padding:0.06});
 const isStandLayer = /(?:^|_)выдпл$/i.test(name);
 const isBoundary = /(?:^|_)(?:грвыд|квпрос|грзем|гркатлф|выдпл)$/i.test(name);
 const importantLabel = /(?:^|_)(?:номкв|площкв|номвыд)$/i.test(name);
 if (!isStandLayer) fieldMap.getPane(pane).style.pointerEvents = 'none';
 const color = value => '#' + Number(value).toString(16).padStart(6, '0');
 const globalPen = settings.match(/^\s*Global\b[^\r\n]*?\bPen\s*\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/im);
 const displayOverride = /^\s*(?:Display\s+)?Override\b/im.test(settings);
 const labels = [];
 const labelLayer = L.layerGroup();
 let labelsFrame=0;
 function renderVisibleLabels() {
  labelsFrame=0;
  if (!fieldMap.hasLayer(group)) return;
  const zoom=fieldMap.getZoom();
  const show=zoom >= (/(?:^|_)номкв$/i.test(name) ? 11 : /(?:^|_)номвыд$/i.test(name) ? 13 : 12);
  const wanted=new Set(),occupied=new Set();
  if(show){
   const view=fieldMap.getBounds().pad(.08),cap=zoom>=15?300:140;
   // CarryMap-like progressive label density: only onscreen labels with space.
   for(const label of labels){
    const ll=label.getLatLng();
    if(!view.contains(ll))continue;
    const pt=fieldMap.latLngToContainerPoint(ll);
    const cell=Math.floor(pt.x/40)+':'+Math.floor(pt.y/32);
    if(occupied.has(cell))continue;
    occupied.add(cell);wanted.add(label);
    if(wanted.size>=cap)break;
   }
  }
  labelLayer.eachLayer(label=>{if(!wanted.has(label))labelLayer.removeLayer(label);});
  for(const label of wanted)if(!labelLayer.hasLayer(label))labelLayer.addLayer(label);
 }
 function syncLabels(){
  if(labelsFrame)cancelAnimationFrame(labelsFrame);
  labelsFrame=requestAnimationFrame(renderVisibleLabels);
 }
 const globalBrush = settings.match(/^\s*Global\b[^\r\n]*?\bBrush\s*\((\d+),(\d+)/im);
 const globalSymbol = settings.match(/^\s*Global\b[^\r\n]*?\bSymbol\s*\(\d+,(\d+),(\d+)/im);
 function style(feature) {
  const ogr = feature.properties?.solin_mapinfo_style || '';
  const pen = ogr.match(/PEN\([^)]*?c:(#[\da-f]{6})/i);
  const brush = ogr.match(/BRUSH\([^)]*?fc:(#[\da-f]{6})/i);
  const penWidth = /PEN\([^)]*?\bw:([\d.]+)(px|pt)?/i.exec(ogr);
  const penPattern = /PEN\([^)]*?\bp:"([^"]+)"/i.exec(ogr)?.[1];
  const dashArray = penPattern?.split(/\s+/).map(value => Number.parseFloat(value)).filter(Number.isFinite);
  return {
   color: displayOverride && globalPen ? color(globalPen[3]) : pen?.[1] || (globalPen ? color(globalPen[3]) : '#333333'),
   dashArray: !displayOverride && dashArray?.length > 1 ? dashArray.join(' ') : null,
   weight: Math.max(isBoundary?3.4:2.7,Math.min(12,displayOverride && globalPen ? +globalPen[1] : penWidth ? +penWidth[1] * (penWidth[2] === 'pt' ? 4/3 : 1) : +(globalPen?.[1] || 2))),
   fillColor: displayOverride && globalBrush ? color(globalBrush[2]) : brush?.[1] || (globalBrush ? color(globalBrush[2]) : '#738b93'),
   fillOpacity: globalBrush?.[1] === '1' ? 0 : 0.35
  };
 }
 const group = L.geoJSON(geojson, {
  pane, renderer, smoothFactor:1.25, style, interactive:isStandLayer,
  filter(feature) {
   if (feature.geometry?.type !== 'Point') return true;
   if(!importantLabel&&!/^LABEL\(/i.test(feature.properties?.solin_mapinfo_style || ''))return true;
   const [lng,lat] = feature.geometry.coordinates;
   const props=feature.properties||{};
   const ogr=props.solin_mapinfo_style||'';
   const label = ogr.match(/LABEL\(t:"((?:[^"\\]|\\.)*)"/);
   const names=/(?:^|_)номкв$/i.test(name)?['Nкварт','НомКв','Номер','KV']:
    /(?:^|_)номвыд$/i.test(name)?['Nвыд','НомВыд','Номер','VD']:['ПлощКв','Площадь','Площ','PL'];
   const fallback=importantLabel?cmfReadProp(props,names):null;
   const value=label?.[1]??fallback;
   if(value==null||String(value).trim()==='')return true;
   const text=document.createElement('span');
   text.textContent=String(value).replace(/\\(["\\])/g,'$1').trim();
   if(importantLabel)text.className='mapinfo-important-label';
   text.style.color = ogr.match(/,c:(#[\da-f]{6})/i)?.[1] || '#111';
   text.style.fontWeight = ogr.includes(',bo:1') ? 'bold' : 'normal';
   text.style.textShadow = '0 0 2px white';
   labels.push(L.marker([lat,lng],{pane,interactive:false,icon:L.divIcon({className:'mapinfo-label',html:text,iconSize:[0,0]})}));
   return false;
  },
  pointToLayer(feature, latlng) {
   const ogr = feature.properties?.solin_mapinfo_style || '';
   const symbolColor = ogr.match(/SYMBOL\([^)]*?c:(#[\da-f]{6})/i)?.[1];
   return L.circleMarker(latlng, {pane, renderer, interactive:false, radius:globalSymbol ? Math.min(10, Number(globalSymbol[2]) / 2) : 4,
    color:globalSymbol ? color(globalSymbol[1]) : symbolColor || '#333', fillOpacity:.85});
  },
  onEachFeature(feature, layer) {
   if (!isStandLayer || !/Polygon$/.test(feature.geometry?.type || '')) return;
   layer.on('click', event => {
    if (fieldMap.getContainer().dataset.mapTool) return;
    const stand = {...feature, properties:{...feature.properties, _mapInfoLayer:name}};
    showCmfSheet(stand, event.latlng, layer);
   });
  }
 });
 const bounds = group.getBounds();
 for (const label of labels) bounds.extend(label.getLatLng());
 if (labels.length) {
  group.on('add', () => {
   labelLayer.addTo(fieldMap);
   fieldMap.on('moveend',syncLabels);
   syncLabels();
  });
  group.on('remove', () => {
   fieldMap.off('moveend',syncLabels);
   if(labelsFrame){cancelAnimationFrame(labelsFrame);labelsFrame=0;}
   labelLayer.clearLayers();
   labelLayer.remove();
  });
 }
 return {pane, renderer, bounds, fileKey, name, count:geojson.features.length, layer:group, visible:!/^\s*Display\s+Off/im.test(settings), format:'MapInfo'};
}

function removeMapFileLayers(removeKey, keepKey) {
 if (!fieldMap) return;
 for (let i = importedMapLayers.length - 1; i >= 0; i--) {
  const entry = importedMapLayers[i];
  const key = entry.fileKey || entry.key;
  if (keepKey ? key === keepKey : key !== removeKey) continue;
  for (const layer of [entry.layer, ...(entry.geometryEntries || []).map(item => item.layer),
   ...Object.values(entry.labelLayers || {}), entry.renderer]) {
   if (layer) fieldMap.removeLayer(layer);
  }
  if (entry.pane) {
   fieldMap.getPane(entry.pane)?.remove();
   delete fieldMap.getPanes()[entry.pane];
  }
  importedMapLayers.splice(i,1);
 }
 window.clearCmfSelection?.();
 window.closeCmfSheet?.();
 renderMapLayerList();
}

function setMapImportStatus(message) {
 let status = document.getElementById('mapImportStatus');
 if (!status) {
  status = document.createElement('div');
  status.id = 'mapImportStatus';
  status.setAttribute('role', 'status');
  document.querySelector('#mapScreen .mapToolbar')?.after(status);
 }
 status.textContent = message;
}

