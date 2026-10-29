/* Independent local workspaces. Original MDB inputs are read-only. */
(()=>{'use strict';
const REGISTRY='SOLIN_WORKSPACES_V1',CHECKPOINT='solin_field_checkpoint_v2',ACTIVE='solin_active_forest_v1';
const copy=x=>JSON.parse(JSON.stringify(x));
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const idOf=r=>String(r.POS)+'::'+String(r.LESN);
let activeId=null,opened=false,tail=Promise.resolve(),initialized=false;const dirtyFields=new Set();
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(REGISTRY,2);r.onupgradeneeded=()=>{for(const name of ['forests','source-recovery-backups'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});}
async function restoreSourceFields(forests){
 const recovery=window.SolinControlSourceRecovery;if(!recovery)return forests;const out=[];
 for(const forest of forests){const result=await recovery.repair(forest);
  if(result.changed){const db=await openDB();try{await new Promise((resolve,reject)=>{
   const tx=db.transaction(['forests','source-recovery-backups'],'readwrite'),store=tx.objectStore('source-recovery-backups'),id=forest.id+'::'+recovery.version,prior=store.get(id);let failure;
   prior.onsuccess=()=>{try{if(!prior.result)store.add({id,forest:copy(forest)});}catch(e){failure=e;tx.abort();}};
   tx.objectStore('forests').put(result.forest);tx.oncomplete=resolve;tx.onabort=()=>reject(failure||tx.error||Error('Восстановление исходных полей отменено'));tx.onerror=()=>reject(failure||tx.error||Error('Не удалось сохранить копию до восстановления'));
  });}finally{db.close();}}
  out.push(result.forest);
 }return out;
}
async function downloadSourceRecoveryBackup(){const db=await openDB();let backup;try{backup=await new Promise((resolve,reject)=>{const r=db.transaction('source-recovery-backups').objectStore('source-recovery-backups').get(activeId+'::'+window.SolinControlSourceRecovery.version);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}if(!backup)throw Error('Копия до восстановления не найдена');const url=URL.createObjectURL(new Blob([JSON.stringify(checkpointFor(backup.forest),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='SOLIN-before-source-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
async function list(){const db=await openDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('forests'),r=tx.objectStore('forests').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}finally{db.close()}}
async function putMany(records){const db=await openDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction('forests','readwrite');for(const r of records)tx.objectStore('forests').put(r);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Запись отменена'));tx.onerror=()=>reject(tx.error)})}finally{db.close()}}
function snapshot(){return {id:activeId,org:copy(D.lesnichestvo[0]),quarters:copy(D.quarters),source:copy(D.source||{}),extraTables:copy(D._transferExtras||{}),updatedAt:new Date().toISOString(),history:JSON.parse(localStorage.getItem(CHECKPOINT)||'{}').history||[]};}
async function persist(){if(!initialized||!activeId)return;const next=snapshot();tail=tail.catch(()=>{}).then(()=>putMany([next]));await tail;return next;}
function legacyClear(){for(const key of ['solin_field_audited_work_v1','solin_user_data_v1','solin_field_overrides_v3'])localStorage.removeItem(key);}
function checkpointFor(forest){return {format:'SOLIN-Field-Backup-v2',at:new Date().toISOString(),quarters:forest.quarters,lesnichestvo:[forest.org],source:forest.source,extraTables:forest.extraTables||{},history:forest.history||[]};}
function clearMap(){if(typeof importedMapLayers!=='undefined'){for(const entry of importedMapLayers){for(const layer of [entry.layer,...(entry.geometryEntries||[]).map(g=>g.layer),...Object.values(entry.labelLayers||{})])if(layer?.removeFrom&&typeof fieldMap!=='undefined')fieldMap?.removeLayer(layer);}importedMapLayers.splice(0);}window.__solinMapRestored=false;window.__cmfSelectedLayer=null;window.closeCmfSheet?.();window.renderMapLayerList?.();}
function heading(){const org=D.lesnichestvo?.[0]||{};document.querySelector('.forestTitle h2').textContent=org.NOS||'Лесничество';document.querySelector('.forestTitle p').textContent=org.NLX||'Лесовладелец не указан';const b=document.querySelector('.forestTitle .change');b.textContent='Сменить';b.onclick=home;b.style.display='inline-flex';document.querySelector('.brand p').textContent=opened?(org.NOS||'Полевые работы'):'Выбор рабочего лесничества';}
async function activate(id){await window.__solinMapImportPromise?.catch(()=>{});await persist();const forest=(await list()).find(r=>r.id===id);if(!forest)throw Error('Лесничество не найдено');localStorage.setItem(CHECKPOINT,JSON.stringify(checkpointFor(forest)));legacyClear();clearMap();activeId=id;D.lesnichestvo=[copy(forest.org)];D.quarters=copy(forest.quarters);D._transferExtras=copy(forest.extraTables||{});D.source={...copy(forest.source||{}),forestDistrict:forest.org.NOS,year:forest.org.GodT};current=null;gps=null;opened=true;localStorage.setItem(ACTIVE,id);heading();refresh();show('quartersScreen');window.dispatchEvent(new Event('solin-forest-changed'));return forest;}
function showHome(){opened=false;show('homeScreen');heading();return renderHome();}
async function home(){await persist();return showHome();}
async function renderHome(){const forests=await list(),host=document.querySelector('#forestList');host.innerHTML=forests.length?'':'<p class="home-empty">Добавьте лесничество из Transfer или создайте новое.</p>';for(const f of forests){const qs=Object.values(f.quarters),rows=qs.flatMap(q=>q.compartments||[]),area=rows.reduce((n,r)=>n+(Number(r.PLV)||0),0);const b=document.createElement('button');b.className='forest-option';b.dataset.forest=f.id;b.innerHTML='<span class="forest-option-icon">♧</span><span><strong>'+html(f.org.NOS)+'</strong><small>'+html(f.org.NLX||'Лесовладелец не указан')+'</small><span class="forest-summary">'+qs.length+' кварталов · '+rows.length+' выделов · '+num(area)+' га</span></span><span class="forest-option-open">Открыть →</span>';b.onclick=()=>activate(f.id).catch(e=>toast(e.message));host.append(b);}document.querySelector('#forestListStatus').textContent=forests.length?'Сохранено на этом устройстве: '+forests.length:'Готово к началу работы';}
function codes(org){for(const [key,name]of [['POS','лесовладельца'],['LESN','лесничества']])if(!/^\d+$/.test(String(org[key]))||Number(org[key])<1||Number(org[key])>32767)throw Error('Номер '+name+' должен быть от 1 до 32767');org.POS=Number(org.POS);org.LESN=Number(org.LESN);return org;}
// SOLI-N desktop hierarchy: область → лесовладелец → лесничество.
// Names and identifiers below were transcribed from the user's three 10.31 screenshots.
// No fabricated districts are added for owners absent from the photographed list.
const SOLIN_REGIONS=[
 {code:100,name:'Акмолинская область включая г. Астана'},
 {code:200,name:'Актюбинская область'},
 {code:300,name:'Алматинская область включая г. Алматы'},
 {code:400,name:'Атырауская область'},
 {code:1400,name:'Восточно-Казахстанская область'},
 {code:600,name:'Жамбылская область'},
 {code:500,name:'Западно-Казахстанская область'},
 {code:700,name:'Карагандинская область'},
 {code:800,name:'Костанайская область'},
 {code:900,name:'Кызылординская область'},
 {code:1000,name:'Мангистауская область'},
 {code:1200,name:'Павлодарская область'},
 {code:1300,name:'Северо-Казахстанская область'},
 {code:1100,name:'Туркестанская область включая г. Шымкент'}
];
const SOLIN_REGION_OWNERS={
 200:[
  {code:201,name:'Иргиз-Тургайский государственный природный резерват'},
  {code:211,name:'Актюбинское государственное учреждение лесного хозяйства'},
  {code:212,name:'Больше-Борсукское государственное учреждение лесного хозяйства'},
  {code:213,name:'Карабутакское государственное учреждение лесного хозяйства'},
  {code:214,name:'Мартукское государственное учреждение лесного хозяйства'},
  {code:215,name:'Темирское государственное учреждение лесного хозяйства'},
  {code:216,name:'Уилское государственное учреждение лесного хозяйства'},
  {code:217,name:'Хобдинское государственное учреждение лесного хозяйства'},
  {code:218,name:'Государственное учреждение "Лесное хозяйство «Оркаш»"'},
  {code:219,name:'Байганинское государственное учреждение лесного хозяйства'},
  {code:230,name:'Актюбинский филиал АО "НК" КазАвтоЖол'},
  {code:251,name:'Актюбинская дистанция защитных лесонасаждений Актюбинское ЛЭП'}
 ]
};
const SOLIN_OWNER_FORESTS={
 213:[{code:1,name:'Комсомольское'},{code:2,name:'Бугетсайское'},{code:3,name:'Карабутакское'}]
};
const matchCode=(a,b)=>String(a)===String(b);
function forestRegionCode(f){
 const known=f?.source?.regionCode??f?.org?.regionCode;
 if(known!=null&&SOLIN_REGIONS.some(x=>matchCode(x.code,known)))return Number(known);
 const owner=Number(f?.org?.POS);
 const fromStatic=SOLIN_REGIONS.find(r=>(SOLIN_REGION_OWNERS[r.code]||[]).some(o=>o.code===owner))?.code;
 if(fromStatic)return fromStatic;
 const legacyRegion=Math.floor(owner/100)*100;
 return SOLIN_REGIONS.some(r=>r.code===legacyRegion)?legacyRegion:null;
}
function catalogOwners(regionCode,forests){
 const owners=new Map((SOLIN_REGION_OWNERS[regionCode]||[]).map(o=>[String(o.code),o]));
 // Rows with LESN=0 are the owner/enterprise headers in original KUch.
 // The original POS numbering assigns owners to 14 historical regions.
 for(const row of window.SOLIN_FOREST_CATALOG?.rows||[]){
  const [pos,lesn,name]=row;
  if(lesn!==0||Math.floor(pos/100)*100!==Number(regionCode)||!name)continue;
  owners.set(String(pos),{code:pos,name});
 }
 for(const f of forests)if(matchCode(forestRegionCode(f),regionCode)&&f.org?.POS&&f.org?.NLX){
  const key=String(f.org.POS);if(!owners.has(key))owners.set(key,{code:Number(f.org.POS),name:f.org.NLX});
 }
 return [...owners.values()].sort((a,b)=>Number(a.code)-Number(b.code));
}
function catalogForests(ownerCode,forests){
 const districts=new Map((SOLIN_OWNER_FORESTS[ownerCode]||[]).map(o=>[String(o.code),o]));
 // A forest district is uniquely addressed by the pair (POS, LESN).
 for(const row of window.SOLIN_FOREST_CATALOG?.rows||[]){
  const [pos,lesn,name]=row;
  if(lesn<=0||!matchCode(pos,ownerCode)||!name)continue;
  districts.set(String(lesn),{code:lesn,name});
 }
 for(const f of forests)if(matchCode(f.org?.POS,ownerCode)&&f.org?.LESN&&f.org?.NOS){
  const key=String(f.org.LESN);if(!districts.has(key))districts.set(key,{code:Number(f.org.LESN),name:f.org.NOS});
 }
 return [...districts.values()].sort((a,b)=>Number(a.code)-Number(b.code));
}
function selectedFromCatalog(input,forests){
 const region=SOLIN_REGIONS.find(r=>matchCode(r.code,input.regionCode));
 if(!region)throw Error('Выберите область');
 const owner=catalogOwners(region.code,forests).find(x=>matchCode(x.code,input.ownerCode));
 if(!owner)throw Error('Выберите лесовладельца из указанной области');
 const district=catalogForests(owner.code,forests).find(x=>matchCode(x.code,input.districtCode));
 if(!district)throw Error('Выберите лесничество выбранного лесовладельца');
 return {region,owner,district};
}
async function create(input){
 const forests=await list();
 let prepared={...input},region=null;
 if(input.regionCode!=null){
  const selected=selectedFromCatalog(input,forests);
  region=selected.region;
  prepared={POS:selected.owner.code,LESN:selected.district.code,NLX:selected.owner.name,NOS:selected.district.name,GodT:new Date().getFullYear()};
 }
 const org={...prepared,NOS:String(prepared.NOS||'').trim(),NLX:String(prepared.NLX||'').trim(),GodT:Number(prepared.GodT||new Date().getFullYear())};
 if(!org.NOS||!org.NLX)throw Error('Укажите названия лесничества и лесовладельца');
 if(!Number.isInteger(org.GodT)||org.GodT<1900||org.GodT>2200)throw Error('Проверьте год таксации');
 if(!org.POS)org.POS=Math.max(0,...forests.map(f=>Number(f.org.POS)))+1;
 if(!org.LESN)org.LESN=1;
 codes(org);
 const id=idOf(org);
 if(forests.some(r=>r.id===id))throw Error('Это лесничество уже существует. Откройте его на главном экране — существующие кварталы и выделы не изменены.');
 const forest={id,org,quarters:{},source:{forestDistrict:org.NOS,year:org.GodT,notes:'Создано в SOLI-N Field',...(region?{regionCode:region.code,regionName:region.name}:{})},history:[],updatedAt:new Date().toISOString()};
 await putMany([forest]);
 await activate(id);
 closeModal();
 return forest;
}
async function newForest(){
 const forests=await list();
 const regionOptions=SOLIN_REGIONS.map(r=>'<option value="'+html(r.code)+'">'+html(r.name)+'</option>').join('');
 openModal('Добавить лесничество',
  '<p class="form-intro">Выберите данные как в настольном SOLI-N. Лесничество будет создано пустым; кварталы и выделы добавляются внутри.</p>'+
  '<div class="formGrid forest-three-selects">'+
  '<label><span>1. Область</span><select id="orgRegion"><option value="">Выберите область…</option>'+regionOptions+'</select></label>'+
  '<label><span>2. Лесовладелец</span><select id="orgOwner" disabled><option value="">Сначала выберите область</option></select></label>'+
  '<label><span>3. Лесничество</span><select id="orgDistrict" disabled><option value="">Сначала выберите лесовладельца</option></select></label>'+
  '</div><p id="forestSelectHint" class="form-intro" aria-live="polite"></p>'+
  '<p id="forestFormError" role="alert"></p>'+
  '<div class="formActions"><button type="button" id="cancelForest">Отмена</button><button type="button" id="saveForest" class="primary" disabled>Создать пустое лесничество</button></div>');
 const region=document.querySelector('#orgRegion'),owner=document.querySelector('#orgOwner'),district=document.querySelector('#orgDistrict');
 const hint=document.querySelector('#forestSelectHint'),save=document.querySelector('#saveForest'),error=document.querySelector('#forestFormError');
 const setOptions=(el,items,placeholder)=>{
  // Keep the native iPhone select mounted: replacing the whole modal while a
  // picker is open can leave an invisible overlay over the form.
  el.replaceChildren(new Option(placeholder,''),
   ...items.map(x=>new Option(x.name+' · '+x.code,String(x.code))));
  el.disabled=!items.length;
 };
 const syncSave=()=>{save.disabled=!(region.value&&owner.value&&district.value);error.textContent='';};
 region.onchange=()=>{
  const owners=catalogOwners(region.value,forests);
  setOptions(owner,owners,owners.length?'Выберите лесовладельца…':'Нет данных лесовладельцев');
  setOptions(district,[],'Сначала выберите лесовладельца');
  hint.textContent=region.value&&!owners.length?'Справочник лесовладельцев этой области ещё не загружен. Нужны данные из оригинального SOLI-N.':'';
  syncSave();
 };
 owner.onchange=()=>{
  const items=catalogForests(owner.value,forests);
  setOptions(district,items,items.length?'Выберите лесничество…':'Нет данных лесничеств');
  hint.textContent=owner.value&&!items.length?'Для выбранного лесовладельца справочник лесничеств ещё не загружен.':'';
  syncSave();
 };
 district.onchange=syncSave;
 document.querySelector('#cancelForest').onclick=closeModal;
 save.onclick=async()=>{
  if(save.disabled)return;
  save.disabled=true;error.textContent='';
  try{await create({regionCode:region.value,ownerCode:owner.value,districtCode:district.value});}
  catch(e){error.textContent=e.message;syncSave();}
 };
}
function previewTransfer(payload){const tables=payload?.tables;if(!tables||!Array.isArray(tables['Лесничество'])||!Array.isArray(tables['Выдел']))throw Error('В Transfer нужны таблицы «Лесничество» и «Выдел»');const groups=new Map();for(const raw of tables['Лесничество']){const org=codes(copy(raw));if(!org.NOS?.trim()||!org.NLX?.trim())throw Error('В Transfer отсутствует название лесничества или лесовладельца');const id=idOf(org);if(groups.has(id))throw Error('Повторяется адрес лесничества '+org.NOS);groups.set(id,{id,org,quarters:{},history:[],source:{forestDistrict:org.NOS,year:org.GodT,notes:'Загружено из Transfer'},updatedAt:new Date().toISOString()});}
 const owner=row=>{const forest=groups.get(idOf(row));if(!forest)throw Error('Запись не привязана к лесничеству в Transfer');return forest;};
 const key=row=>['POS','LESN','KV','KGLF','VD'].map(k=>row[k]??'').join('::');const stands=new Map(),quarterKeys=new Set();
 for(const raw of tables['Квартал']||[]){const row=copy(raw),f=owner(row);if(!/^\d+$/.test(String(row.KV))||Number(row.KV)<1)throw Error('Неверный номер квартала');const qKey=[row.POS,row.LESN,row.KV,row.KGLF??'',row.Klxr??'',row.Fzona??''].join('::');if(quarterKeys.has(qKey))throw Error('Дублируется квартал по категории лесного фонда');quarterKeys.add(qKey);const q=f.quarters[String(Number(row.KV))]??={quarterRows:[],compartments:[]};q.quarterRows.push(row);}
 for(const raw of tables['Выдел']){const row=copy(raw),f=owner(row);if(!/^\d+$/.test(String(row.KV))||Number(row.KV)<1||row.VD==null||typeof row.VD==='object'||String(row.VD).trim()===''||!Number.isFinite(Number(row.PLV))||Number(row.PLV)<=0)throw Error('Проверьте номер квартала, выдела и площадь в Transfer');row.KV=Number(row.KV);row.VD=String(row.VD);const k=key(row);if(stands.has(k))throw Error('Дублируется полный адрес выдела в Transfer');if(Object.keys(row._children||{}).some(m=>(tables[m]||[]).length))throw Error('Файл одновременно содержит вложенные макеты и отдельные таблицы. Используйте экспорт Transfer без дублирования');row._children=row._children||{};stands.set(k,row);const q=f.quarters[String(row.KV)]??={quarterRows:[],compartments:[]};if(!q.quarterRows.some(x=>String(x.KGLF??'')===String(row.KGLF??'')))q.quarterRows.push({POS:row.POS,LESN:row.LESN,KV:row.KV,KGLF:row.KGLF??null});q.compartments.push(row);}
 for(const [name,rows]of Object.entries(tables)){if(!/^Макет\d+$/.test(name))continue;if(!Array.isArray(rows))throw Error('Неверная таблица '+name);if(!D.transfSchema[name])throw Error('Таблица '+name+' пока не поддерживается; импорт остановлен без потери данных');for(const raw of rows){const row=copy(raw);let target=stands.get(key(row));if(!target&&row.KGLF==null){const matches=[...stands.values()].filter(r=>['POS','LESN','KV','VD'].every(k=>String(r[k])===String(row[k])));if(matches.length===1)target=matches[0];}if(!target)throw Error('Строка '+name+' не связана с единственным выделом');(target._children[name]??=[]).push(row);}}
 for(const [name,rows]of Object.entries(tables)){if(['Лесничество','Квартал','Выдел'].includes(name)||/^Макет\d+$/.test(name))continue;if(!Array.isArray(rows))throw Error('Неверная таблица '+name);for(const forest of groups.values()){const selected=rows.filter(r=>r.POS==null||r.LESN==null||idOf(r)===forest.id);(forest.extraTables??={})[name]=copy(selected);}}if(!groups.size)throw Error('В файле нет лесничеств');return [...groups.values()];}
async function importTransfer(payload,options={}){const groups=previewTransfer(payload),existing=await list();if(groups.some(g=>existing.some(f=>f.id===g.id))&&!options.replace)throw Error('Лесничество с таким адресом уже сохранено. Для замены выберите соответствующее действие в предпросмотре');await persist();await putMany(groups);if(groups.some(g=>g.id===activeId)){const f=groups.find(g=>g.id===activeId);/* Prevent activate from persisting the replaced in-memory copy. */activeId=null;await activate(f.id);}await home();return groups;}
async function importFile(file){if(!file)return;openModal('Чтение Transfer','<p>Читаю файл на этом устройстве…</p>');try{await persist();const payload=await SolinTransferReader.read(file),groups=previewTransfer(payload),existing=await list(),conflicts=groups.filter(g=>existing.some(f=>f.id===g.id));openModal('Загрузка Transfer','<p>Файл: '+html(file.name)+'. Данные остаются на устройстве.</p>'+groups.map(f=>'<article class="transfer-preview"><h3>'+html(f.org.NOS)+'</h3><p>'+html(f.org.NLX)+'</p><small>'+Object.keys(f.quarters).length+' кварталов · '+Object.values(f.quarters).reduce((n,q)=>n+q.compartments.length,0)+' выделов</small></article>').join('')+(conflicts.length?'<p class="import-warning">Будут заменены сохранённые данные: '+conflicts.map(f=>html(f.org.NOS)).join(', ')+'. Сначала сохраните их копию.</p>'+conflicts.map(f=>'<button class="saveConflictBackup" data-forest="'+html(f.id)+'">Копия: '+html(f.org.NOS)+'</button>').join('')+'':'<p>Новые лесничества появятся в списке. Остальные сохранятся.</p>')+'<div class="formActions"><button onclick="closeModal()">Отмена</button><button id="acceptTransfer" class="primary">'+(conflicts.length?'Заменить указанные лесничества':'Добавить лесничества')+'</button></div><p id="transferError" role="alert"></p>');for(const b of document.querySelectorAll('.saveConflictBackup'))b.onclick=()=>{const f=existing.find(x=>x.id===b.dataset.forest),u=URL.createObjectURL(new Blob([JSON.stringify(checkpointFor(f),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='SOLIN-backup-'+f.org.POS+'-'+f.org.LESN+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);};document.querySelector('#acceptTransfer').onclick=async()=>{const b=document.querySelector('#acceptTransfer');b.disabled=true;try{await importTransfer(payload,{replace:!!conflicts.length});
  // Keep the ORIGINAL Jet file locally for one-touch MDB export after import.
  // Do not publish it or send it to any network. Only cache after successful import.
  if(/\.mdb$/i.test(file.name)&&groups.length===1&&file.size<=12*1024*1024&&window.SolinOfflineMDB?.saveStored){
    try{
      const bytes=await file.arrayBuffer(),b=new Uint8Array(bytes,0,Math.min(bytes.byteLength,32));
      if(b.length>=32&&String.fromCharCode(...b.slice(4,19))==='Standard Jet DB'){
        const org=groups[0].org,k=[org.POS,org.LESN,org.GodT].join('::');
        await window.SolinOfflineMDB.saveStored(k,{name:file.name,bytes});
      }
    }catch(error){console.warn('Не удалось сохранить исходный MDB для экспорта:',error);}
  }
  closeModal();toast('Загружено лесничеств: '+groups.length)}catch(e){document.querySelector('#transferError').textContent=e.message;b.disabled=false}};}catch(e){openModal('Не удалось загрузить Transfer','<p>'+html(e.message)+'</p><button onclick="closeModal()">Закрыть</button>')}}
function bind(){document.querySelector('#newForestButton').onclick=newForest;// A real full-size file input sits over the visual Transfer button.
 // This avoids iOS/Safari rejecting a scripted click on a hidden input.
 const nativePicker=document.querySelector('#transferForestInput');
 // The native input is inside the styled label. The physical tap goes to the input,
 // so no synthetic click is needed (and no duplicate chooser can be opened).
 nativePicker.onchange=e=>{
   const file=e.currentTarget.files?.[0];
   e.currentTarget.value=''; // selecting the same MDB again must still fire change
   if(!file)return; // Cancelled the native picker: never import stale data.
   const status=document.querySelector('#forestListStatus');
   if(status)status.textContent='Выбран файл: '+file.name+'. Проверяю Transfer…';
   void importFile(file);
 };document.querySelector('#homeButton').onclick=()=>home().catch(e=>toast(e.message));const old=window.show;window.show=function(id){if(!initialized&&id!=='homeScreen'){return old('homeScreen');}document.body.classList.toggle('workspace-home',id==='homeScreen');old(id);};
 window.addEventListener('solin-saved',()=>persist().catch(e=>toast('Не удалось сохранить лесничество: '+e.message)));
 const prevBackup=window.solinCore.commitImport;window.solinCore.commitImport=function(x){if(x.lesnichestvo?.[0]&&idOf(x.lesnichestvo[0])!==activeId)throw Error('Эта копия относится к другому лесничеству. Загрузите её через главное окно');const result=prevBackup(x);persist().catch(e=>toast(e.message));return result;};
}
async function init(){try{bind();let forests=await list();const recovery=JSON.parse(localStorage.getItem(CHECKPOINT)||'null');if(recovery?.lesnichestvo?.[0]&&recovery.quarters){const org=recovery.lesnichestvo[0],id=idOf(org),stored=forests.find(f=>f.id===id);if(!stored||Date.parse(recovery.at||0)>Date.parse(stored.updatedAt||0)){await putMany([{id,org,quarters:recovery.quarters,extraTables:recovery.extraTables||{},source:recovery.source||{},history:recovery.history||[],updatedAt:recovery.at||new Date().toISOString()}]);forests=await list();}}
 if(!forests.length){activeId=idOf(D.lesnichestvo[0]);initialized=true;await persist();forests=await list();}
 try{forests=await restoreSourceFields(forests);}catch(e){if(window.SolinControlSourceRecovery)window.SolinControlSourceRecovery.lastError=e?.message||String(e);forests=await list();}
 activeId=null;initialized=true;const last=forests.find(r=>r.id===localStorage.getItem(ACTIVE))||forests[0];localStorage.setItem(CHECKPOINT,JSON.stringify(checkpointFor(last)));legacyClear();D.lesnichestvo=[copy(last.org)];D.quarters=copy(last.quarters);D._transferExtras=copy(last.extraTables||{});D.source=copy(last.source||{});activeId=last.id;refresh();await showHome();window.dispatchEvent(new Event('solin-workspaces-ready'));}catch(e){document.querySelector('#forestListStatus').textContent='Ошибка локального хранилища: '+e.message;throw e;}}
let readyResolve,readyReject;const ready=new Promise((r,j)=>{readyResolve=r;readyReject=j});
window.SolinWorkspace={list,activate,create,previewTransfer,importTransfer,persist,home,importFile,downloadSourceRecoveryBackup,get activeId(){return activeId},ready};
window.addEventListener('solin-ready',()=>init().then(readyResolve,readyReject),{once:true});
})();

