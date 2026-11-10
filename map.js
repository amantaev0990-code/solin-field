let fieldMap=null,baseGoogle=null,baseOSM=null,userMarker=null;
const cmf2Layers=[];
const importedMapLayers=[];
const cmfBounds=[[49.88939,58.94556],[50.34764,59.66651]];
function cmfTypeLabel(t){return({region:'полигон',polyline:'линия',text:'текст',point:'точка'})[t]||t||'слой'}
function renderMapLayerList(){const box=document.getElementById('mapLayerList');if(!box)return;if(!importedMapLayers.length){box.innerHTML='<div class="mapLayerRow"><span>＋</span><span>Откройте карту<small>CMF2 · KML/KMZ · GeoJSON · GeoPackage · GPX</small></span></div>';return}box.innerHTML=importedMapLayers.map((x,i)=>{if(x.cmf2){const info=x.info||{},layers=info.layers||[],decoded=new Map((x.geometryEntries||[]).map(g=>[g.source,g]));const head=`<div class="mapLayerRow"><span>◈</span><span><b>${escapeMapHtml(x.name)}</b><small>CMF2 · ${info.decodedFeatures||0} объектов · ${info.decodedVertices||0} вершин${info.zone?` · UTM ${info.zone}`:''}</small></span></div>`;const rows=layers.map(l=>{const g=decoded.get(l.source);if(g)return `<label class="mapLayerRow cmfSubLayer"><input type="checkbox" ${g.visible?'checked':''} onchange="toggleCmfLayer(${i},'${escapeMapJs(l.source)}',this.checked)"><span>${l.type==='region'?'⬠':'╱'}</span><span>${escapeMapHtml(l.name||l.source)}<small>${g.count} объектов · ${cmfTypeLabel(l.type)}</small></span></label>`;return `<div class="mapLayerRow cmfSubLayer"><span>${l.type==='text'?'T':'•'}</span><span>${escapeMapHtml(l.name||l.source)}<small>${cmfTypeLabel(l.type)} · геометрия пока не декодируется</small></span></div>`}).join('');return head+rows}return `<label class="mapLayerRow"><input type="checkbox" ${x.visible?'checked':''} onchange="toggleImportedLayer(${i},this.checked)"><span>${escapeMapHtml(x.name)}<small>${x.count} объектов${x.format?` · ${x.format}`:''}</small></span></label>`}).join('')}
function ensureMapFileUi(){if(document.getElementById('mapFileInput'))return;const toolbar=document.querySelector('#mapScreen .mapToolbar');if(toolbar){const b=document.createElement('button');b.className='mapMode';b.textContent='⌁ Открыть файл';b.onclick=openMapFilePicker;toolbar.appendChild(b)}const input=document.createElement('input');input.id='mapFileInput';input.type='file';input.multiple=true;input.style.display='none';input.onchange=()=>handleMapFiles(input);document.body.appendChild(input)}
function initFieldMap(){ensureMapFileUi();if(fieldMap||!window.L)return;fieldMap=L.map('fieldMap',{zoomControl:true,preferCanvas:true,renderer:L.canvas({padding:.2,tolerance:5}),zoomAnimation:true,fadeAnimation:false,markerZoomAnimation:false});baseGoogle=L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{subdomains:['mt0','mt1','mt2','mt3'],updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,maxZoom:21,attribution:'Спутниковые снимки Google'});baseOSM=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,maxZoom:20,attribution:'© OpenStreetMap'});baseGoogle.addTo(fieldMap);installFieldMapTools(fieldMap);fieldMap.fitBounds(cmfBounds,{padding:[4,4]});renderMapLayerList();void window.SolinOfflineImagery?.attach?.(fieldMap);setTimeout(()=>fieldMap.invalidateSize(),150)}
function openMapScreen(){show('mapScreen');document.querySelectorAll('.sectionTab').forEach(x=>x.classList.toggle('active',x.dataset.s==='mapScreen'));initFieldMap();setTimeout(()=>fieldMap?.invalidateSize(),120)}
function setBaseMap(kind){if(!fieldMap)initFieldMap();if(!fieldMap)return;window.SolinOfflineImagery?.hide?.();if(kind==='google'){if(fieldMap.hasLayer(baseOSM))fieldMap.removeLayer(baseOSM);if(!fieldMap.hasLayer(baseGoogle))baseGoogle.addTo(fieldMap)}else{if(fieldMap.hasLayer(baseGoogle))fieldMap.removeLayer(baseGoogle);if(!fieldMap.hasLayer(baseOSM))baseOSM.addTo(fieldMap)}document.getElementById('satBtn')?.classList.toggle('active',kind==='google');document.getElementById('osmBtn')?.classList.toggle('active',kind==='osm')}
function toggleMapLayers(){document.getElementById('mapLayerPanel')?.classList.toggle('hiddenPanel')}
let stopMapGps=null,userAccuracy=null;
function mapLocateMe(){
 if(!fieldMap)initFieldMap();
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
function makeGeoGroup(geo){return L.geoJSON(geo,{smoothFactor:2.5,style:styleImportedFeature,pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:5,weight:2,fillOpacity:.8}),onEachFeature:bindImportedFeature}).addTo(fieldMap)}
function addGeoLayer(name,geo,key,format){if(!geo||geo.type!=='FeatureCollection')throw new Error('Нет векторных объектов');const group=makeGeoGroup(geo);const entry={key,name,layer:group,count:(geo.features||[]).length,visible:true,format};importedMapLayers.push(entry);return entry}
async function handleMapFiles(input){const files=[...(input?.files||[])];if(!files.length)return;if(!fieldMap)initFieldMap();let added=0,lastBounds=null;for(const file of files){try{const baseKey=`${file.name}|${file.size}|${file.lastModified}`;if(importedMapLayers.some(x=>x.fileKey===baseKey||x.key===baseKey))continue;const detected=window.SolinMapImport?await SolinMapImport.detect(file):'';
if(detected==='cmf2'){toast('CMF2: декодирую геометрию…');const info=await inspectCmf2(file);const entry={key:baseKey,fileKey:baseKey,name:file.name,cmf2:true,count:info.decodedFeatures||0,projection:info.projection,visible:true,info,geometryEntries:[]};for(const g of info.geometryLayers||[]){const group=makeGeoGroup(g.geojson),ge={source:g.source,name:g.name,type:g.type,count:g.count,layer:group,visible:true};entry.geometryEntries.push(ge);added+=g.count;const b=group.getBounds();if(b?.isValid())lastBounds=b}if(!entry.geometryEntries.length&&info.extent?.wgs84){const e=info.extent.wgs84,b=[[e.south,e.west],[e.north,e.east]];entry.layer=L.rectangle(b,{weight:2,fillOpacity:0,dashArray:'7 6',interactive:false}).addTo(fieldMap);lastBounds=entry.layer.getBounds()}importedMapLayers.push(entry);toast(entry.geometryEntries.length?`CMF2 открыт: ${info.decodedFeatures} объектов · ${entry.geometryEntries.length} слоёв`:`CMF2 открыт, но геометрия этого файла не распознана`);continue}
if(detected==='gpkg'){const pack=await openGeoPackageFile(file);if(!pack.layers.length)throw new Error('В GeoPackage нет векторных таблиц');for(const t of pack.layers){const e=addGeoLayer(`${file.name} › ${t.name}`,t.geojson,`${baseKey}|${t.name}`,'GPKG');e.fileKey=baseKey;added+=e.count;const b=e.layer.getBounds();if(b?.isValid())lastBounds=b}toast(`GeoPackage открыт: ${pack.layers.length} слоёв`);continue}
let geo,format;if(detected==='kmz'){const kml=await SolinMapImport.kmzToKml(file);geo=kmlToGeoJSON(kml);format='KMZ'}else if(detected==='kml'){geo=kmlToGeoJSON(await file.text());format='KML'}else if(detected==='gpx'){geo=SolinMapImport.gpxToGeoJSON(await file.text());format='GPX'}else if(detected==='geojson'){geo=JSON.parse(await file.text());format='GeoJSON'}else throw new Error(`Формат ${detected||'неизвестен'} пока не читается`);const e=addGeoLayer(file.name,geo,baseKey,format);e.fileKey=baseKey;added+=e.count;const b=e.layer.getBounds();if(b?.isValid())lastBounds=b}catch(e){console.error(e);toast(`${file.name}: ${e.message||'не удалось открыть'}`)}}renderMapLayerList();if(lastBounds?.isValid())fieldMap.fitBounds(lastBounds,{padding:[18,18]});if(added)toast(`Открыто объектов: ${added}`);if(input)input.value=''}
function toggleImportedLayer(index,on){const x=importedMapLayers[index];if(!x||!fieldMap||x.cmf2)return;x.visible=on;if(on){if(!fieldMap.hasLayer(x.layer))x.layer.addTo(fieldMap)}else if(fieldMap.hasLayer(x.layer))fieldMap.removeLayer(x.layer)}
function toggleCmfLayer(index,source,on){const x=importedMapLayers[index],g=x?.geometryEntries?.find(v=>v.source===source);if(!g||!fieldMap)return;g.visible=on;if(on){if(!fieldMap.hasLayer(g.layer))g.layer.addTo(fieldMap)}else if(fieldMap.hasLayer(g.layer))fieldMap.removeLayer(g.layer)}
function styleImportedFeature(f){const t=f?.geometry?.type||'',p=f?.properties||{};if(t.includes('Line'))return{weight:p.CMF_LAYER?2:3,opacity:.95};if(t.includes('Polygon'))return{weight:2,fillOpacity:p.CMF_LAYER?.includes('ВыдПород')?0.12:0.18};return{weight:2,fillOpacity:.8}}
function bindImportedFeature(feature,layer){layer.on('click',e=>{if(typeof showCmfSheet==='function')showCmfSheet(feature,e.latlng,layer);else{const p=feature?.properties||{};layer.bindPopup(Object.entries(p).slice(0,20).map(([k,v])=>`<b>${escapeMapHtml(k)}</b>: ${escapeMapHtml(v)}`).join('<br>')||'Объект').openPopup()}})}
function escapeMapHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escapeMapJs(v){return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
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

