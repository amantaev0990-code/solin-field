/* SOLI-N Field offline prototype additions, 2026-10-23.
   Works on existing web app; source CMF2 structural-v4 and inline v7 remain unchanged. */
(function(){
'use strict';
const STORE="solin_field_overrides_v3";
function saved(){try{return JSON.parse(localStorage.getItem(STORE)||"{}")}catch{return{}}}
function key(row){return ['POS','LESN','KV','KGLF','VD'].map(k=>row[k]??D?.lesnichestvo?.[0]?.[k]??'').join('::')}
function applyOverrides(){
 if(typeof D==="undefined"||!D?.quarters||localStorage.getItem('solin_field_checkpoint_v2'))return;
 const changes=saved();
 for(const q of Object.values(D.quarters||{}))for(const row of q.compartments||[]){
  const patch=changes[key(row)]||(Object.values(D.quarters).flatMap(q=>q.compartments).filter(v=>String(v.KV)===String(row.KV)&&String(v.VD)===String(row.VD)).length===1?changes[String(row.KV)+"::"+String(row.VD)]:null);if(!patch)continue;
  Object.assign(row,patch.fields||{});
  if(patch.m10){row._children=row._children||{};const a=row._children.Макет10||(row._children.Макет10=[{}]);if(!a.length)a.push({});Object.assign(a[0],patch.m10);}
 }
}
const bootOld=window.boot;
if(typeof bootOld==="function"){window.boot=async function(){await bootOld();applyOverrides();refresh();};}
const renderOld=window.renderComp;
if(typeof renderOld==="function"){window.renderComp=function(){renderOld();
const container=document.querySelector("#humanContent");if(!container)return;
const bar=document.createElement("div");bar.className="solinEditBar";bar.innerHTML='<button class="primary" id="solinEditComp">✎ Изменить карточку</button><button class="secondary" id="solinAttachPhoto">📷 Фото выдела</button><button class="secondary" id="solinGetCompGPS">⌖ GPS</button>';
container.prepend(bar);document.getElementById("solinEditComp").onclick=window.solinEditComp;
document.getElementById("solinAttachPhoto").onclick=window.solinOpenPhoto;
document.getElementById("solinGetCompGPS").onclick=window.solinSaveGPS;
let photos=document.createElement('div');photos.id='solinPhotoList';container.appendChild(photos);window.solinRenderPhotos().catch(()=>{});
};}
const mapOpenOld=window.openMapScreen;
const handleOld=window.handleMapFiles;
const mapScope=()=>window.SolinWorkspace?.mapScope||'map-only';
const projectMaps={
 '213::1':{path:'213-1.cmf2',name:'Комсомольское л-во.cmf2'},
 '213::2':{path:'213-2.cmf2',name:'Богетсайское л-во.cmf2'}
};
function queueMap(task){
 const operation=(window.__solinMapImportPromise||Promise.resolve()).catch(()=>{}).then(task);
 window.__solinMapImportPromise=operation;
 return operation;
}
let activeMapKey = null;
let libraryScope;
window.openMapScreen = function() {
 if (!mapOpenOld()) return false;
 const scope = mapScope();
 if (scope !== libraryScope || !importedMapLayers.length) {
  libraryScope = scope;
  activeMapKey = null;
 }
 const placeholder = document.querySelector('#mapLayerList .mapLayerRow');
 if (placeholder && !importedMapLayers.length) placeholder.onclick = window.openMapFilePicker;
 void queueMap(refreshMapLibrary).catch(error => toast(error.message));
 return true;
};

async function activateMap(file, scope) {
 if (scope !== mapScope()) return false;
 const key = mapFileKey(file);
 const accepted = await handleOld({files:[file]});
 if (!accepted.has(key)) return false;
 if (scope !== mapScope()) {
  removeMapFileLayers(key);
  return false;
 }
 removeMapFileLayers(null, key);
 activeMapKey = key;
 return true;
}

window.handleMapFiles = function(input) {
 const files = Array.from(input?.files || []);
 if (input) input.value = '';
 if (!files.length) return Promise.resolve(new Set());
 const scope = mapScope();
 return queueMap(async () => {
  const accepted = new Set();
  for (const file of files) {
   if (!await activateMap(file, scope)) continue;
   const key = mapFileKey(file);
   accepted.add(key);
   try {
    await dbPut('maps', {id:scope+'|'+key, forestId:scope, file, name:file.name,
     lastModified:file.lastModified, date:Date.now()});
   } catch (error) {
    toast('Карта открыта, но не сохранена офлайн: ' + error.message);
   }
  }
  await refreshMapLibrary();
  return accepted;
 });
};
const mkdir=()=>new Promise((resolve,reject)=>{const r=indexedDB.open("SOLIN_FIELD_OFFLINE_V3",1);
 r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("maps"))r.result.createObjectStore("maps",{keyPath:"id"});if(!r.result.objectStoreNames.contains("photos"))r.result.createObjectStore("photos",{keyPath:"id"});};
 r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});
async function dbPut(store,data){const db=await mkdir();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(data);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)};});}
async function dbGetAll(store){const db=await mkdir();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).getAll();req.onsuccess=()=>{db.close();resolve(req.result||[])};req.onerror=()=>{db.close();reject(req.error)}});}
async function dbClear(store){const db=await mkdir();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}});}
function safe(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function val(id){return document.getElementById(id)?.value??''}
function inp(id,label,value,type='text'){return '<label><span>'+safe(label)+'</span><input id="'+id+'" type="'+type+'" value="'+safe(value??'')+'" /></label>'}
function cur(){return typeof current!=='undefined'?current:null}
window.solinEditComp=()=>{
 const r=cur();if(!r)return toast("Выдел не выбран");const m10=(r._children?.Макет10||[])[0]||{};
 const list=[inp("fPLV","Площадь, га",r.PLV,"number"),inp("fKU","Категория угодий (код SOLI-N)",r.KU),inp("fM3Pr","Преобладающая порода (код)",r.M3Pr),inp("fM3B","Класс бонитета (код)",r.M3B),
 inp("fPOR","Макет 10 · Порода",m10.POR),inp("fLET","Макет 10 · Возраст, лет",m10.LET,"number"),inp("fPH","Макет 10 · Высота, м",m10.PH,"number"),inp("fPD2","Макет 10 · Диаметр, см",m10.PD2,"number"),inp("fPOL","Макет 10 · Полнота",m10.POL,"number"),inp("fZAP","Макет 10 · Запас, м³/га",m10.ZAP,"number")].join('');
 openModal("Карточка: квартал "+r.KV+" / выдел "+r.VD,'<div class="solinFormHelp">Сохраняется локально в этом браузере. Исходная база SOLI-N не меняется.</div><div class="formGrid">'+list+'</div><div class="formActions"><button class="secondary" onclick="closeModal()">Отмена</button><button class="primary" onclick="solinSaveComp()">Сохранить изменения</button></div>');
};
window.solinSaveComp=()=>{
const r=cur();if(!r)return;
const p=Number(val("fPLV").replace(",","."));
if(!Number.isFinite(p)||p<=0){toast('Площадь должна быть больше нуля');return;}
const fields={PLV:p,KU:val("fKU"),M3Pr:val("fM3Pr"),M3B:val("fM3B")};
const m10={POR:val("fPOR"),LET:val("fLET"),PH:val("fPH"),PD2:val("fPD2"),POL:val("fPOL"),ZAP:val("fZAP")};
const prev=saved();prev[key(r)]={fields,m10,updatedAt:new Date().toISOString()};
try{localStorage.setItem(STORE,JSON.stringify(prev));}catch(e){toast('Недостаточно места для сохранения');return;}
Object.assign(r,fields);r._children=r._children||{};const a=r._children.Макет10||(r._children.Макет10=[{}]);if(!a.length)a.push({});Object.assign(a[0],m10);
closeModal();renderComp();refresh();toast('Карточка сохранена локально');
};
window.solinSaveGPS=()=>{
 const r=cur();if(!r)return;
 if(!navigator.geolocation){toast('GPS недоступен');return;}
 navigator.geolocation.getCurrentPosition(pos=>{
 const v={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy,at:new Date().toISOString()};const records=saved();
 records[key(r)]=records[key(r)]||{};records[key(r)].gps=v;try{localStorage.setItem(STORE,JSON.stringify(records));}catch(_){}
 openModal('GPS выдела '+r.VD,'<div class="humanSection"><h3>Сохранены координаты WGS84</h3><p>'+v.latitude.toFixed(7)+'° N, '+v.longitude.toFixed(7)+'° E</p><p>Точность: '+Math.round(v.accuracy)+' м</p></div><button class="primary" onclick="closeModal()">Закрыть</button>');
 },err=>toast('GPS: '+(err?.message||'доступ не получен')),{enableHighAccuracy:true,timeout:15000});
};
window.solinOpenPhoto=()=>{
 const r=cur();if(!r)return;
 const pick=document.createElement('input');pick.type='file';pick.accept='image/*';pick.multiple=true;pick.onchange=async()=>{
 let savedCount=0;
 for(const file of Array.from(pick.files||[]).slice(0,5))try{await dbPut('photos',{id:key(r)+'::'+Date.now()+'::'+Math.random().toString(16).slice(2),rowKey:key(r),name:file.name,blob:file,date:Date.now()});savedCount++;}catch(e){console.warn(e)}
 toast('Фото сохранено: '+savedCount);window.solinRenderPhotos().catch(console.warn);
 };pick.click();
};
window.solinRenderPhotos=async()=>{
 const r=cur(),box=document.getElementById('solinPhotoList');if(!box||!r)return;
 const photos=(await dbGetAll('photos')).filter(x=>x.rowKey===key(r)||(x.rowKey===String(r.KV)+'::'+String(r.VD)&&Object.values(D.quarters).flatMap(q=>q.compartments).filter(v=>String(v.KV)===String(r.KV)&&String(v.VD)===String(r.VD)).length===1));
 box.replaceChildren();
 if(!photos.length)return;
 const h=document.createElement('h3');h.textContent='Фото выдела ('+photos.length+')';box.appendChild(h);
 const grid=document.createElement('div');grid.className='solinPhotos';
 for(const p of photos){const img=document.createElement('img');const url=URL.createObjectURL(p.blob);img.src=url;img.alt=p.name;img.onclick=()=>window.open(url,'_blank');img.onload=()=>{};grid.appendChild(img);}
 box.appendChild(grid);
};
function mapLibraryButton(text, action) {
 const button = document.createElement('button');
 button.type = 'button';
 button.className = 'mapMode';
 button.textContent = text;
 button.addEventListener('click', () => {
  button.disabled = true;
  void queueMap(action).catch(error => toast(error.message)).finally(() => { button.disabled = false; });
 });
 return button;
}

async function refreshMapLibrary() {
 const toolbar = document.querySelector('#mapScreen .mapToolbar');
 if (!toolbar) return;
 let library = document.getElementById('mapLibrary');
 if (!library) {
  library = document.createElement('details');
  library.id = 'mapLibrary';
  const summary = document.createElement('summary');
  summary.textContent = 'Мои карты';
  const list = document.createElement('div');
  list.id = 'mapLibraryList';
  library.append(summary, list);
  toolbar.after(library);
 }
 const list = library.querySelector('#mapLibraryList');
 const scope = mapScope();
 const saved = (await dbGetAll('maps')).filter(row => row.forestId === scope || (!row.forestId && scope === '213::2'));
 if (scope !== mapScope()) return;
 list.replaceChildren();
 const add = document.createElement('button');
 add.type = 'button';
 add.className = 'mapMode';
 add.textContent = 'Добавить карту';
 add.addEventListener('click', window.openMapFilePicker);
 list.append(add);

 function addRow(name, key, open, deleteSaved) {
  const row = document.createElement('div');
  row.className = 'mapLayerRow';
  const title = document.createElement('span');
  title.textContent = name;
  row.append(title);
  if (key && activeMapKey === key) row.append(mapLibraryButton('Закрыть', async () => {
   removeMapFileLayers(key);
   activeMapKey = null;
   setMapImportStatus('');
   await refreshMapLibrary();
  }));
  else row.append(mapLibraryButton('Открыть', async () => {
   if (scope !== mapScope()) return;
   await activateMap(await open(), scope);
   await refreshMapLibrary();
  }));
  if (deleteSaved) row.append(mapLibraryButton('Удалить', async () => {
   if (!window.confirm('Убрать карту «' + name + '» из приложения?')) return;
   await deleteSaved();
   if (activeMapKey === key) {
    removeMapFileLayers(key);
    activeMapKey = null;
    setMapImportStatus('');
   }
   await refreshMapLibrary();
  }));
  list.append(row);
 }

 for (const item of saved.sort((a,b) => b.date - a.date)) {
  if (!item.file) continue;
  const file = item.file instanceof File ? item.file :
   new File([item.file], item.name, {lastModified:item.lastModified ?? item.date});
  addRow(item.name, mapFileKey(file), () => file, () => deleteCachedMap(item.id));
 }
 const builtIn = projectMaps[scope];
 if (builtIn) {
  const key = activeMapKey?.startsWith(builtIn.name + '|') && activeMapKey.endsWith('|0') ? activeMapKey : '';
  addRow(builtIn.name + ' · встроенная', key, async () => {
   const response = await fetch('./maps/' + builtIn.path);
   if (!response.ok) throw Error('Встроенный файл карты недоступен');
   return new File([await response.blob()], builtIn.name, {lastModified:0});
  });
 }
}

async function deleteCachedMap(id) {
 const db = await mkdir();
 return new Promise((resolve, reject) => {
  const tx = db.transaction('maps', 'readwrite');
  tx.objectStore('maps').delete(id);
  tx.oncomplete = () => { db.close(); resolve(); };
  tx.onabort = () => { db.close(); reject(tx.error || Error('Карта не удалена')); };
 });
}
window.solinClearCachedMaps=async()=>{if(!confirm('Удалить сохранённые локальные файлы карт из браузера?'))return;await dbClear('maps');toast('Кэш карт очищен');};
window.solinExportEdits=()=>{
 const data={format:'SOLIN-Field-JSON-Prototype-v1',exportedAt:new Date().toISOString(),overrides:saved(),created:JSON.parse(localStorage.getItem('solin_user_data_v1')||'{}')};
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='solin-field-work-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('Копия JSON готова');
};
window.solinImportEdits=()=>{
 const pick=document.createElement('input');pick.type='file';pick.accept='.json,application/json';
 pick.onchange=async()=>{try{const obj=JSON.parse(await pick.files[0].text());if(obj.format!=='SOLIN-Field-JSON-Prototype-v1')throw Error('Неверный формат резервной копии');if(!confirm('Заменить локальные правки из файла?'))return;localStorage.setItem(STORE,JSON.stringify(obj.overrides||{}));localStorage.setItem('solin_user_data_v1',JSON.stringify(obj.created||{}));toast('Импорт выполнен. Перезагрузите страницу.');}catch(e){toast(e.message||'Ошибка импорта')}};pick.click();
};
document.addEventListener('DOMContentLoaded',()=>{
 document.querySelector('#mapScreen .mapOfflineHint')?.insertAdjacentHTML('beforeend','<br><small>CMF2 structural-v4 / атрибуты inline-v7 сохранены из предыдущей SOLI-N Field. Спутниковые снимки требуют интернет; собственные контуры CMF2 можно видеть офлайн.</small>');
 const m=document.querySelector('#menuScreen .workspace');
 if(m)m.insertAdjacentHTML('beforeend','<button class="menuRow" onclick="solinImportEdits()"><span><b>Открыть резервную копию JSON</b><small>Восстановить изменения</small></span><span>⇧</span></button><button class="menuRow" onclick="solinClearCachedMaps()"><span><b>Очистить офлайн-кэш карт</b><small>Только сохранённые карты, не карточки</small></span><span>×</span></button><div class="solinFormHelp">Прототип SOLI-N Field · основан на исходном интерфейсе и базе проекта · файлы и правки хранятся локально. Экспорт Transfer нужно проверить с настольной программой.</div>');
 const sr=document.createElement('style');sr.textContent='.solinEditBar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.solinEditBar button{font-size:13px;min-height:42px}.solinFormHelp{background:#112f1e;color:#bde2c6;border:1px solid #316541;border-radius:12px;padding:11px;margin:10px 0;line-height:1.5;font-size:12px}.solinPhotos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.solinPhotos img{width:100%;aspect-ratio:1.2;object-fit:cover;border-radius:10px;cursor:pointer}#fieldMap{background:linear-gradient(135deg,#15291f,#1a352b)}';document.head.appendChild(sr);
});
})();

