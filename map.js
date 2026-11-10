let fieldMap=null,baseGoogle=null,baseOSM=null,userMarker=null;
const cmf2Layers=[];
const importedMapLayers=window.importedMapLayers=[];
function cmfTypeLabel(t){return({region:'полигон',polyline:'линия',text:'текст',point:'точка'})[t]||t||'слой'}
function renderMapLayerList(){const box=document.getElementById('mapLayerList');if(!box)return;if(!importedMapLayers.length){box.innerHTML='<div class="mapLayerRow"><span>＋</span><span>Откройте карту<small>ZIP MapInfo · CMF2 · KML/KMZ · GeoJSON · GeoPackage · GPX</small></span></div>';return}box.innerHTML=importedMapLayers.map((x,i)=>{if(x.cmf2){const info=x.info||{},layers=info.layers||[],decoded=new Map((x.geometryEntries||[]).map(g=>[g.source,g]));const head=`<div class="mapLayerRow"><span>◈</span><span><b>${escapeMapHtml(x.name)}</b><small>CMF2 · ${info.decodedFeatures||0} объектов · ${info.decodedVertices||0} вершин${info.zone?` · UTM ${info.zone}`:''}</small></span></div>`;const rows=layers.map(l=>{const g=decoded.get(l.source);if(g)return `<label class="mapLayerRow cmfSubLayer"><input type="checkbox" ${g.visible?'checked':''} onchange="toggleCmfLayer(${i},${escapeMapHtml(JSON.stringify(String(l.source)))},this.checked)"><span>${l.type==='region'?'⬠':'╱'}</span><span>${escapeMapHtml(l.name||l.source)}<small>${g.count} объектов · ${cmfTypeLabel(l.type)}</small></span></label>`;return `<div class="mapLayerRow cmfSubLayer"><span>${l.type==='text'?'T':'•'}</span><span>${escapeMapHtml(l.name||l.source)}<small>${cmfTypeLabel(l.type)} · геометрия пока не декодируется</small></span></div>`}).join('');return head+rows}return `<label class="mapLayerRow"><input type="checkbox" ${x.visible?'checked':''} onchange="toggleImportedLayer(${i},this.checked)"><span>${escapeMapHtml(x.name)}<small>${x.count} объектов${x.format?` · ${x.format}`:''}</small></span></label>`}).join('')}
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
     bounds.extend(entry.layer.getBounds());
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

function installFieldMapTools(map) {
 const storageKey = 'solin.field.map-marks.v1';
 let marks = [];
 try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(saved)) marks = saved.filter(mark => mark &&
   Number.isFinite(mark.lat) && Math.abs(mark.lat) <= 90 &&
   Number.isFinite(mark.lng) && Math.abs(mark.lng) <= 180 && typeof mark.name === 'string');
 } catch (error) {
  console.error(error);
  toast('Не удалось прочитать сохранённые метки');
 }
 const markers = L.layerGroup().addTo(map);
 const ruler = L.polyline([], {color:'#facc15', weight:4, interactive:false}).addTo(map);
 let mode = '';
 let points = [];
 let distance = 0;
 const control = L.control({position:'topright'});
 control.onAdd = () => {
  const panel = L.DomUtil.create('div', 'leaflet-bar');
  panel.style.cssText = 'background:white;color:#222;padding:4px;max-width:220px';
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  function button(title, action) {
   const element = document.createElement('button');
   element.type = 'button';
   element.textContent = title;
   element.style.minHeight = '36px';
   element.addEventListener('click', action);
   panel.append(element);
   return element;
  }
  const markButton = button('Метка', () => setMode(mode === 'mark' ? '' : 'mark'));
  const rulerButton = button('Линейка', () => setMode(mode === 'ruler' ? '' : 'ruler'));
  button('Сброс', () => {
   points = [];
   distance = 0;
   ruler.setLatLngs(points);
   setMode('');
  });
  panel.append(status);

  function setMode(next) {
   mode = next;
   markButton.setAttribute('aria-pressed', String(mode === 'mark'));
   rulerButton.setAttribute('aria-pressed', String(mode === 'ruler'));
   updateStatus();
  }

  function updateStatus() {
   if (mode === 'mark') status.textContent = 'Коснитесь карты для новой метки';
   else if (points.length) status.textContent = distance >= 1000
    ? (distance / 1000).toFixed(2) + ' км'
    : distance.toFixed(1) + ' м';
   else status.textContent = mode === 'ruler' ? 'Коснитесь начальной точки' : '';
  }

  function save(next) {
   try {
    localStorage.setItem(storageKey, JSON.stringify(next));
   } catch (error) {
    console.error(error);
    toast('Не удалось сохранить изменения меток');
    return;
   }
   marks = next;
   drawMarks();
  }

  function drawMarks() {
   markers.clearLayers();
   for (const mark of marks) {
    const popup = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = mark.name;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Удалить метку';
    remove.addEventListener('click', () => save(marks.filter(item => item !== mark)));
    popup.append(title, remove);
    L.circleMarker([mark.lat, mark.lng], {radius:8, weight:2, color:'#fff', fillColor:'#d23434', fillOpacity:1, bubblingMouseEvents:false}).bindPopup(popup).addTo(markers);
   }
  }

  map.on('click', ({latlng}) => {
   if (mode === 'mark') {
    const name = window.prompt('Название метки', 'Метка');
    if (name === null) return;
    const {lat, lng} = latlng.wrap();
    save([...marks, {name:name.trim().slice(0, 120) || 'Метка', lat, lng}]);
    setMode('');
   } else if (mode === 'ruler') {
    if (points.length) distance += map.distance(points[points.length - 1], latlng);
    points.push(latlng);
    ruler.setLatLngs(points);
    updateStatus();
   }
  });
  drawMarks();
  setMode('');
  return panel;
 };
 control.addTo(map);
}

function createMapInfoLayer({name, geojson, settings}, fileKey, index, count) {
 const pane = 'mapinfo-' + importedMapLayers.length + '-' + index;
 fieldMap.createPane(pane).style.zIndex = String(410 + (count - index) / count * 80 | 0);
 const color = value => '#' + Number(value).toString(16).padStart(6, '0');
 const globalPen = settings.match(/^\s*Global\b[^\r\n]*?\bPen\s*\((\d+),(\d+),(\d+)\)/im);
 const globalBrush = settings.match(/^\s*Global\b[^\r\n]*?\bBrush\s*\((\d+),(\d+)/im);
 const globalSymbol = settings.match(/^\s*Global\b[^\r\n]*?\bSymbol\s*\(\d+,(\d+),(\d+)/im);
 function style(feature) {
  const ogr = feature.properties?.solin_mapinfo_style || '';
  const pen = ogr.match(/PEN\([^)]*?c:(#[\da-f]{6})/i);
  const brush = ogr.match(/BRUSH\([^)]*?fc:(#[\da-f]{6})/i);
  return {
   color: globalPen ? color(globalPen[3]) : pen?.[1] || '#333333',
   weight: globalPen ? Math.min(8, Number(globalPen[1])) : 2,
   fillColor: globalBrush ? color(globalBrush[2]) : brush?.[1] || '#738b93',
   fillOpacity: globalBrush?.[1] === '1' ? 0 : 0.35
  };
 }
 const group = L.geoJSON(geojson, {
  pane, smoothFactor:0, style,
  pointToLayer(feature, latlng) {
   const ogr = feature.properties?.solin_mapinfo_style || '';
   const label = ogr.match(/LABEL\(t:"((?:[^"\\]|\\.)*)"/);
   if (label) {
    const text = document.createElement('span');
    text.textContent = label[1].replace(/\\(["\\])/g, '$1').trim();
    text.style.color = ogr.match(/,c:(#[\da-f]{6})/i)?.[1] || '#111';
    text.style.fontWeight = ogr.includes(',bo:1') ? 'bold' : 'normal';
    text.style.textShadow = '0 0 2px white, 0 0 2px white';
    return L.marker(latlng, {pane, icon:L.divIcon({className:'mapinfo-label', html:text, iconSize:[0,0]})});
   }
   const symbolColor = ogr.match(/SYMBOL\([^)]*?c:(#[\da-f]{6})/i)?.[1];
   return L.circleMarker(latlng, {pane, radius:globalSymbol ? Math.min(10, Number(globalSymbol[2]) / 2) : 4,
    color:globalSymbol ? color(globalSymbol[1]) : symbolColor || '#333', fillOpacity:.85});
  },
  onEachFeature:bindImportedFeature
 });
 return {fileKey, name, count:geojson.features.length, layer:group, visible:!/^\s*Display\s+Off/im.test(settings), format:'MapInfo'};
}

function setMapImportStatus(message) {
 let status = document.getElementById('mapImportStatus');
 if (!status) {
  status = document.createElement('div');
  status.id = 'mapImportStatus';
  status.setAttribute('role', 'status');
  document.getElementById('mapLayerList')?.before(status);
 }
 status.textContent = message;
}

