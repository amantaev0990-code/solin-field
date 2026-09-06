let fieldMap=null,baseGoogle=null,baseOSM=null,userMarker=null;
const cmf2Layers=[
 {id:'stands',name:'Выделы / породы',source:'4_2_ВыдПород_region',type:'полигоны'},
 {id:'water',name:'Воды',source:'4_2_Воды_region',type:'полигоны'},
 {id:'banks',name:'Берега',source:'4_2_Берега_polyline',type:'линии'},
 {id:'roads',name:'Дороги',source:'4_2_Дороги_polyline',type:'линии'},
 {id:'quarterCuts',name:'Квартальные просеки',source:'4_2_КвПрос_polyline',type:'линии'},
 {id:'symbols',name:'Условные знаки',source:'4_2_УслЗн_region',type:'полигоны'},
 {id:'landBorders',name:'Границы земель',source:'4_2_ГрЗем_polyline',type:'линии'},
 {id:'labels',name:'Текст',source:'4_2_Текст_text',type:'подписи'},
 {id:'neighbors',name:'Смежества',source:'4_2_Смежества_text',type:'подписи'},
 {id:'quarterNumbers',name:'Номера кварталов',source:'4_2_НомКв_text',type:'подписи'}
];
const cmfBounds=[[49.88939,58.94556],[50.34764,59.66651]];
function renderMapLayerList(){const box=document.getElementById('mapLayerList');if(!box)return;box.innerHTML=cmf2Layers.map((x,i)=>`<label class="mapLayerRow"><input type="checkbox" ${i===0||x.id==='quarterCuts'||x.id==='quarterNumbers'?'checked':''} onchange="toggleCmfLayer('${x.id}',this.checked)"><span>${x.name}<small>${x.source}</small></span></label>`).join('')}
function initFieldMap(){if(fieldMap||!window.L)return;fieldMap=L.map('fieldMap',{zoomControl:true,preferCanvas:true});baseGoogle=L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{subdomains:['mt0','mt1','mt2','mt3'],maxZoom:21,attribution:'Спутниковые снимки Google'});baseOSM=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap'});baseGoogle.addTo(fieldMap);fieldMap.fitBounds(cmfBounds,{padding:[4,4]});renderMapLayerList();loadAvailableGeoJsonLayers();setTimeout(()=>fieldMap.invalidateSize(),150)}
async function loadAvailableGeoJsonLayers(){for(const layer of cmf2Layers){try{const r=await fetch(`./map-layers/${layer.id}.geojson`,{cache:'no-store'});if(!r.ok)continue;const data=await r.json();layer.leaflet=L.geoJSON(data,{style:()=>({weight:2,fillOpacity:.16}),pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:4})});const cb=[...document.querySelectorAll('#mapLayerList input')][cmf2Layers.indexOf(layer)];if(cb?.checked)layer.leaflet.addTo(fieldMap)}catch(e){console.warn(e)}}}
function toggleCmfLayer(id,on){const x=cmf2Layers.find(v=>v.id===id);if(!x)return;if(x.leaflet){if(on)x.leaflet.addTo(fieldMap);else fieldMap.removeLayer(x.leaflet)}else if(on)toast(`${x.name}: геометрия CMF2 ещё не извлечена`)}
function openMapScreen(){show('mapScreen');document.querySelectorAll('.sectionTab').forEach(x=>x.classList.toggle('active',x.dataset.s==='mapScreen'));initFieldMap();setTimeout(()=>fieldMap?.invalidateSize(),120)}
function setBaseMap(kind){if(!fieldMap)initFieldMap();if(!fieldMap)return;if(kind==='google'){if(fieldMap.hasLayer(baseOSM))fieldMap.removeLayer(baseOSM);if(!fieldMap.hasLayer(baseGoogle))baseGoogle.addTo(fieldMap)}else{if(fieldMap.hasLayer(baseGoogle))fieldMap.removeLayer(baseGoogle);if(!fieldMap.hasLayer(baseOSM))baseOSM.addTo(fieldMap)}document.getElementById('satBtn')?.classList.toggle('active',kind==='google');document.getElementById('osmBtn')?.classList.toggle('active',kind==='osm')}
function toggleMapLayers(){document.getElementById('mapLayerPanel')?.classList.toggle('hiddenPanel')}
function mapLocateMe(){if(!navigator.geolocation)return toast('GPS недоступен');navigator.geolocation.getCurrentPosition(p=>{const ll=[p.coords.latitude,p.coords.longitude];if(!fieldMap)initFieldMap();if(userMarker)userMarker.setLatLng(ll);else userMarker=L.circleMarker(ll,{radius:9,weight:3,fillOpacity:1}).addTo(fieldMap).bindPopup('Моё местоположение');fieldMap.setView(ll,16);userMarker.openPopup()},()=>toast('Не удалось получить GPS'),{enableHighAccuracy:true,timeout:10000})}
