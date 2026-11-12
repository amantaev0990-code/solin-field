/* Independent local workspaces. Original MDB inputs are read-only. */
(()=>{'use strict';
const REGISTRY='SOLIN_WORKSPACES_V1',CHECKPOINT='solin_field_checkpoint_v2',ACTIVE='solin_active_forest_v1',INITIALIZED='solin_workspaces_initialized_v1';
const copy=x=>JSON.parse(JSON.stringify(x));
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const idOf=r=>String(r.POS)+'::'+String(r.LESN);
let activeId=null,opened=false,tail=Promise.resolve(),initialized=false,sourceFallback=null;const dirtyFields=new Set();
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
async function repairAddressCodes(forest){
 const ctx=window.SolinAddressContext;if(!ctx||!forest?.org)return 0;
 const before=copy(forest),org=forest.org;
 let count=0;
 if(!(Number(org.KTO)>0)){
  const code=ctx.originalKTO(org.POS,org.LESN);
  if(code!==null){org.KTO=code;count++;}
 }
 const missing=v=>v===null||v===undefined||String(v).trim()==='';
 for(const [kv,q] of Object.entries(forest.quarters||{})){
  if(!q||typeof q!=='object')continue;
  const rows=q.quarterRows?.length?q.quarterRows:[q.meta||{}];
  for(const row of rows){
   if(missing(row.Klxr)){
    const unique=ctx.uniqueQuarterZone(row);
    if(unique!==null){row.Klxr=unique;count++;}
   }
   for(const [k,value] of Object.entries({POS:org.POS,LESN:org.LESN,KV:Number(kv)})){
    if(missing(row[k])&&!missing(value)){row[k]=value;count++;}
   }
  }
  if(!q.quarterRows?.length)q.meta=rows[0];
  for(const stand of q.compartments||[]){
   if(missing(stand.KV)){stand.KV=Number(kv);count++;}
   const inherited=ctx.enrichStand(stand,q,org);
   count+=Object.keys(inherited.values).length;
   count+=ctx.enrichMakets(stand);
  }
 }
 if(!count)return 0;
 // Preserve one immutable backup of the unmodified forest before first
 // automatic code repair, in the existing IndexedDB recovery store.
 const db=await openDB();
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction(['forests','source-recovery-backups'],'readwrite'),
   backups=tx.objectStore('source-recovery-backups'),id=forest.id+'::forest-address-inheritance-v1';
  const req=backups.get(id);
  req.onsuccess=()=>{if(!req.result)backups.put({id,forest:before});};
  tx.objectStore('forests').put(forest);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('Не удалось восстановить адресные коды'));
  tx.onabort=()=>reject(tx.error||Error('Восстановление адресных кодов отменено'));
 });}finally{db.close();}
 return count;
}
function snapshot(){return {id:activeId,org:copy(D.lesnichestvo[0]),quarters:copy(D.quarters),source:copy(D.source||{}),extraTables:copy(D._transferExtras||{}),updatedAt:new Date().toISOString(),history:JSON.parse(localStorage.getItem(CHECKPOINT)||'{}').history||[]};}
async function persist(){if(!initialized||!activeId)return;const next=snapshot();tail=tail.catch(()=>{}).then(()=>putMany([next]));await tail;return next;}
// Never erase earlier users' local cards merely because a new workspace version is installed.
function legacyClear(){/* legacy saves are kept until the taxator explicitly exports/deletes them */}
function checkpointFor(forest){return {format:'SOLIN-Field-Backup-v2',at:new Date().toISOString(),quarters:forest.quarters,lesnichestvo:[forest.org],source:forest.source,extraTables:forest.extraTables||{},history:forest.history||[]};}
// Offline cross-device handoff. Use the same SOLIN-Field-Backup-v2
// understood by SolinTransferReader on iOS, Android and GitHub Pages.
function exportForest(){
 if(!activeId||!D?.lesnichestvo?.[0])throw Error('Откройте лесничество для переноса');
 const forest=snapshot();
 if(forest.id!==activeId)throw Error('Активная база изменилась, повторите экспорт');
 const backup=checkpointFor(forest),org=forest.org;
 const json=JSON.stringify(backup,null,2);
 const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
 const link=document.createElement('a');
 link.href=url;
 link.download='SOLIN-Field-'+String(org.POS)+'-'+String(org.LESN)+'-'+String(org.GodT||'2026')+'.json';
 document.body.append(link);
 link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),15000);
 // The export contains the fresh in-memory data even if IndexedDB is still
 // flushing writes; also persist for crash safety without blocking Safari's
 // user-gesture-limited download.
 void persist().catch(e=>toast('Копия создана, но сохранение на устройстве требует проверки: '+e.message));
 return {filename:link.download,quarters:Object.keys(forest.quarters).length,
  stands:Object.values(forest.quarters).reduce((n,q)=>n+(q.compartments?.length||0),0)};
}
function clearMap(){if(typeof importedMapLayers!=='undefined'){for(const entry of importedMapLayers){for(const layer of [entry.layer,...(entry.geometryEntries||[]).map(g=>g.layer),...Object.values(entry.labelLayers||{})])if(layer?.removeFrom&&typeof fieldMap!=='undefined')fieldMap?.removeLayer(layer);}importedMapLayers.splice(0);}window.__solinMapRestored=false;window.__cmfSelectedLayer=null;window.closeCmfSheet?.();window.renderMapLayerList?.();}
function heading(){const org=D.lesnichestvo?.[0]||{};const title=document.querySelector('.forestTitle h2'),owner=document.querySelector('.forestTitle p'),button=document.querySelector('.forestTitle .change'),brand=document.querySelector('.brand p');if(title)title.textContent=org.NOS||'Лесничество';if(owner)owner.textContent=org.NLX||'Лесовладелец не указан';if(button){button.textContent='Сменить';button.onclick=home;button.style.display='inline-flex';}if(brand)brand.textContent=opened?(org.NOS||'Полевые работы'):'Выбор рабочего лесничества';}
async function activate(id){await window.__solinMapImportPromise?.catch(()=>{});await persist();const forest=(await list()).find(r=>r.id===id);if(!forest)throw Error('Лесничество не найдено');
 // Recover only missing fields with a proven source row. Never rewrite
 // explicit imported MDB values or infer Klxr from a region/owner alone.
 await repairAddressCodes(forest);
 localStorage.setItem(CHECKPOINT,JSON.stringify(checkpointFor(forest)));legacyClear();clearMap();activeId=id;D.lesnichestvo=[copy(forest.org)];D.quarters=copy(forest.quarters);D._transferExtras=copy(forest.extraTables||{});D.source={...copy(forest.source||{}),forestDistrict:forest.org.NOS,year:forest.org.GodT};current=null;gps=null;opened=true;localStorage.setItem(ACTIVE,id);heading();refresh();show(document.getElementById('mainScreen')?'mainScreen':'quartersScreen');ensureForestSelectorButton();window.dispatchEvent(new Event('solin-forest-changed'));return forest;}
function showHome(){opened=false;show('homeScreen');heading();return renderHome();}
async function home(){await persist();return showHome();}
async function renderHome(){const forests=await list(),host=document.querySelector('#forestList');host.innerHTML=forests.length?'':'<p class="home-empty">Добавьте лесничество из Transfer или создайте новое.</p>';for(const f of forests){const qs=Object.values(f.quarters),rows=qs.flatMap(q=>q.compartments||[]),area=rows.reduce((n,r)=>n+(Number(r.PLV)||0),0);const b=document.createElement('button');b.className='forest-option';b.dataset.forest=f.id;b.innerHTML='<span class="forest-option-icon">♧</span><span><strong>'+html(f.org.NOS)+'</strong><small>'+html(f.org.NLX||'Лесовладелец не указан')+'</small><span class="forest-summary">'+qs.length+' кварталов · '+rows.length+' выделов · '+num(area)+' га</span></span><span class="forest-option-open">Открыть →</span>';b.onclick=()=>activate(f.id).catch(e=>toast(e.message));const entry=document.createElement('div');entry.className='forest-entry';const remove=document.createElement('button');remove.type='button';remove.className='forest-delete';remove.innerHTML=window.solinDeleteIcon||'🗑';remove.title='Удалить лесничество';remove.setAttribute('aria-label','Удалить лесничество «'+f.org.NOS+'»');remove.onclick=()=>openDeleteForest(f.id).catch(e=>toast(e.message));entry.append(b,remove);host.append(entry);}const status=document.querySelector('#forestListStatus');
if(status)status.textContent=forests.length?'Сохранено на этом устройстве: '+forests.length:
 'Список лесничеств пуст. Сохранённые данные не удалены. Можно загрузить Transfer или восстановить исходное лесничество.';
if(!forests.length&&sourceFallback?.org&&Object.keys(sourceFallback.quarters||{}).length){
 const restore=document.createElement('button');
 restore.type='button';restore.className='forest-option';restore.id='solin-restore-source-forest';
 restore.innerHTML='<strong>Восстановить лесничество из исходного комплекта</strong> <small>'+html(sourceFallback.org.NOS||'')+' · '+Object.keys(sourceFallback.quarters).length+' кварталов</small>';
 restore.onclick=async()=>{
  restore.disabled=true;
  try{
   const backup=copy(sourceFallback);
   const found=(await list()).find(x=>x.id===backup.id);
   if(!found)await putMany([backup]); // preserve any concurrent new data
   await activate(backup.id);
  }catch(e){restore.disabled=false;toast('Не удалось восстановить лесничество: '+e.message);}
 };
 host.append(restore);
}
}

 // Both confirmations must be completed before any stored data is changed.
 async function openDeleteForest(id){
  const forest=(await list()).find(f=>f.id===id);
  if(!forest)return toast('Лесничество уже удалено');
  const name=html(forest.org.NOS),qs=Object.values(forest.quarters||{}),stands=qs.reduce((n,q)=>n+(q.compartments?.length||0),0);
  openModal('Удаление лесничества · 1 из 2',
   '<p>Удалить лесничество <b>«'+name+'»</b> целиком?</p>'+
   '<p>'+qs.length+' кварталов · '+stands+' выделов. Также будут удалены карточки, черновики и связанные сохранённые данные этого лесничества.</p>'+
   '<div class="formActions"><button type="button" id="forestDeleteCancel1">Отмена</button><button type="button" class="primary" id="forestDeleteNext">Продолжить</button></div>');
  document.querySelector('#forestDeleteCancel1').onclick=closeModal;
  document.querySelector('#forestDeleteNext').onclick=()=>confirmDeleteForest(id).catch(e=>toast(e.message));
 }
 async function confirmDeleteForest(id){
  const forest=(await list()).find(f=>f.id===id);
  if(!forest){closeModal();return toast('Лесничество уже удалено');}
  openModal('Окончательное подтверждение · 2 из 2',
   '<p><b>Внимание!</b> Лесничество <b>«'+html(forest.org.NOS)+'»</b> и все его кварталы, выделы, карточки и черновики будут безвозвратно удалены с этого устройства.</p>'+
   '<p class="import-warning">Отменить это действие после удаления невозможно.</p>'+
   '<div class="formActions"><button type="button" id="forestDeleteCancel2">Отмена</button><button type="button" id="forestDeleteFinal">Удалить навсегда</button></div><p id="forestDeleteError" role="alert"></p>');
  document.querySelector('#forestDeleteCancel2').onclick=closeModal;
  document.querySelector('#forestDeleteFinal').onclick=async()=>{
   const button=document.querySelector('#forestDeleteFinal');button.disabled=true;button.textContent='Удаление…';
   try{await deleteForest(id);closeModal();await showHome();toast('Лесничество удалено');}
   catch(e){const status=document.querySelector('#forestDeleteError');if(status)status.textContent='Не удалось удалить: '+e.message;button.disabled=false;button.textContent='Удалить навсегда';}
  };
 }
 // Delete by full POS::LESN address; other forests retain their workspaces and drafts.
 async function deleteForest(id){
  await tail.catch(()=>{});
  if(id===activeId)await persist();
  const forest=(await list()).find(f=>f.id===id);
  if(!forest)throw Error('Лесничество уже удалено');
  const prefix=id+'::';
  // The originally imported MDB copy is stored separately from the forest.
  if(window.SolinOfflineMDB?.deleteStored)
   await window.SolinOfflineMDB.deleteStored([forest.org.POS,forest.org.LESN,forest.org.GodT].join('::'));
  const db=await openDB();
  try{await new Promise((resolve,reject)=>{
   const tx=db.transaction(['forests','source-recovery-backups'],'readwrite');
   tx.objectStore('forests').delete(id);
   const store=tx.objectStore('source-recovery-backups');
   const cursor=store.openCursor(IDBKeyRange.bound(prefix,prefix+String.fromCharCode(65535)));
   cursor.onsuccess=()=>{const row=cursor.result;if(row){row.delete();row.continue();}};
   tx.oncomplete=resolve;
   tx.onerror=()=>reject(tx.error||Error('Ошибка удаления IndexedDB'));
   tx.onabort=()=>reject(tx.error||Error('Удаление отменено'));
  });}finally{db.close();}
  const draftPrefix='solin_field_card_draft_v1:';
  for(let i=localStorage.length-1;i>=0;i--){
   const key=localStorage.key(i);
   if(!key?.startsWith(draftPrefix))continue;
   try{const address=JSON.parse(key.slice(draftPrefix.length));
    if(Array.isArray(address)&&idOf({POS:address[0],LESN:address[1]})===id)localStorage.removeItem(key);
   }catch(_){}
  }
  try{const key='solin_field_audited_work_v1',edits=JSON.parse(localStorage.getItem(key)||'{}');
   if(edits&&typeof edits==='object'){let changed=false;
    for(const k of Object.keys(edits))if(k.startsWith(prefix)){delete edits[k];changed=true;}
    if(changed)localStorage.setItem(key,JSON.stringify(edits));
   }
  }catch(_){}
  window.SolinCardEditor?.refreshDrafts?.();
  localStorage.setItem(INITIALIZED,'1'); // do not recreate demo data if this was the last forest
  if(id===activeId){
   activeId=null;opened=false;current=null;gps=null;
   localStorage.removeItem(ACTIVE);localStorage.removeItem(CHECKPOINT);legacyClear();
   clearMap();D.lesnichestvo=[];D.quarters={};D._transferExtras={};D.source={};
   refresh();heading();window.dispatchEvent(new Event('solin-forest-changed'));
  }
  return true;
 }
// Structured record deletion: mutate only the current workspace and preserve original MDB imports.
const sameAddress=(a,b)=>String(a??'')===String(b??'');
function pruneDeletedRecordCaches(k,stand=null){
 const org=D.lesnichestvo?.[0];if(!org)return;
 const draftPrefix='solin_field_card_draft_v1:';
 for(let i=localStorage.length-1;i>=0;i--){
  const key=localStorage.key(i);if(!key?.startsWith(draftPrefix))continue;
  try{
   const address=JSON.parse(key.slice(draftPrefix.length));
   if(!Array.isArray(address)||!sameAddress(address[0],org.POS)||!sameAddress(address[1],org.LESN)||!sameAddress(address[2],k))continue;
   if(stand&&(!sameAddress(address[3],stand.KGLF)||!sameAddress(address[4],stand.VD)))continue;
   localStorage.removeItem(key);
  }catch(_){}
 }
 try{
  const key='solin_field_audited_work_v1',edits=JSON.parse(localStorage.getItem(key)||'{}');
  if(edits&&typeof edits==='object'){
   const prefix=[org.POS,org.LESN,k].join('::')+'::';
   const exact=stand?[org.POS,org.LESN,k,stand.KGLF??'',stand.VD].join('::'):null;
   let changed=false;
   for(const address of Object.keys(edits)){
    if((stand?address===exact:address.startsWith(prefix))){delete edits[address];changed=true;}
   }
   if(changed)localStorage.setItem(key,JSON.stringify(edits));
  }
 }catch(_){}
 // This legacy import overlay must not recreate a deleted quarter on the next boot.
 localStorage.removeItem('solin_user_data_v1');
 window.SolinCardEditor?.refreshDrafts?.();
}
async function commitRecordDeletion(reason,undo){
 const checkpoint=localStorage.getItem(CHECKPOINT);
 try{
  if(typeof window.solinCore?.checkpoint!=='function')throw Error('Хранилище резервных копий ещё не готово');
  window.solinCore.checkpoint(reason);
  await persist();
 }catch(error){
  undo();
  try{
   if(checkpoint===null)localStorage.removeItem(CHECKPOINT);
   else localStorage.setItem(CHECKPOINT,checkpoint);
   // Restore the previous snapshot even if a queued asynchronous save ran.
   await persist();
  }catch(restoreError){console.error('Не удалось восстановить предыдущую копию после ошибки удаления',restoreError);}
  throw error;
 }
}
async function deleteQuarter(k,expectedForestId){
 if(!initialized||!activeId||activeId!==expectedForestId)throw Error('Активное лесничество изменилось — повторите удаление');
 await tail.catch(()=>{});
 const quarter=D.quarters?.[k];
 if(!quarter)throw Error('Квартал уже удалён');
 delete D.quarters[k];
 await commitRecordDeletion('Удаление квартала '+k,()=>{D.quarters[k]=quarter;});
 try{pruneDeletedRecordCaches(k);}catch(e){console.warn('Не удалось очистить вспомогательные записи квартала',e);}
 return true;
}
async function deleteStand(stand,expectedForestId){
 if(!initialized||!activeId||activeId!==expectedForestId)throw Error('Активное лесничество изменилось — повторите удаление');
 await tail.catch(()=>{});
 const quarter=D.quarters?.[String(stand?.KV)],list=quarter?.compartments;
 const index=Array.isArray(list)?list.indexOf(stand):-1;
 if(index<0)throw Error('Выдел уже удалён или его данные изменились');
 list.splice(index,1);
 await commitRecordDeletion('Удаление выдела '+stand.KV+'-'+stand.VD+' КГЛФ '+(stand.KGLF??''),()=>{list.splice(index,0,stand);});
 try{pruneDeletedRecordCaches(stand.KV,stand);}catch(e){console.warn('Не удалось очистить вспомогательные записи выдела',e);}
 return true;
}
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
const REGION_BY_KTO={110000000:100,150000000:200,190000000:300,230000000:400,270000000:500,310000000:600,350000000:700,390000000:800,430000000:900,470000000:1000,510000000:1100,550000000:1200,590000000:1300,630000000:1400};
const regionFromKTO=kto=>REGION_BY_KTO[Number(kto)]??null;
// Restore the original forest registry's KTO only by an exact (POS, LESN) match.
// Avoid guessing regions from names or POS prefixes.
function originalForestKTO(pos,lesn){
 const matches=(window.SOLIN_FOREST_CATALOG?.rows||[]).filter(row=>
  String(row[0])===String(pos)&&String(row[1])===String(lesn)&&
  Number.isFinite(Number(row[4]))&&Number(row[4])>0);
 return matches.length===1?Number(matches[0][4]):null;
}
function forestRegionCode(f){
 const known=f?.source?.regionCode??f?.org?.regionCode;
 if(known!=null&&SOLIN_REGIONS.some(x=>matchCode(x.code,known)))return Number(known);
 const owner=Number(f?.org?.POS);
 const originalOwner=window.SOLIN_FOREST_CATALOG?.rows?.find(r=>r[0]===owner&&r[1]===0);
 if(originalOwner)return regionFromKTO(originalOwner[4]);
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
  const [pos,lesn,name,,kto]=row;
  if(lesn!==0||regionFromKTO(kto)!==Number(regionCode)||!name)continue;
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
  prepared={POS:selected.owner.code,LESN:selected.district.code,NLX:selected.owner.name,NOS:selected.district.name,
   KTO:originalForestKTO(selected.owner.code,selected.district.code),GodT:new Date().getFullYear()};
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
 const syncSave=(clearError=true)=>{
  const complete=!!(region.value&&owner.value&&district.value);
  const exists=complete&&forests.some(f=>matchCode(f.org?.POS,owner.value)&&matchCode(f.org?.LESN,district.value));
  save.disabled=!complete;
  save.textContent=exists?'Открыть существующее лесничество':'Создать пустое лесничество';
  if(clearError)error.textContent='';
 };
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
 district.onchange=()=>syncSave();
 document.querySelector('#cancelForest').onclick=closeModal;
 save.onclick=async()=>{
  if(save.disabled)return;
  save.disabled=true;error.textContent='';
  try{
   const existing=forests.find(f=>matchCode(f.org?.POS,owner.value)&&matchCode(f.org?.LESN,district.value));
   if(existing){await activate(existing.id);closeModal();}
   else await create({regionCode:region.value,ownerCode:owner.value,districtCode:district.value});
  }catch(e){error.textContent=e.message||'Не удалось создать лесничество';syncSave(false);}
 };
}
function previewTransfer(payload){const tables=payload?.tables;if(!tables||!Array.isArray(tables['Лесничество'])||!Array.isArray(tables['Выдел']))throw Error('В Transfer нужны таблицы «Лесничество» и «Выдел»');const groups=new Map();for(const raw of tables['Лесничество']){const org=codes(copy(raw));if(!org.NOS?.trim()||!org.NLX?.trim())throw Error('В Transfer отсутствует название лесничества или лесовладельца');const id=idOf(org);if(groups.has(id))throw Error('Повторяется адрес лесничества '+org.NOS);groups.set(id,{id,org,quarters:{},history:[],source:{forestDistrict:org.NOS,year:org.GodT,notes:'Загружено из Transfer'},updatedAt:new Date().toISOString()});}
 const owner=row=>{const forest=groups.get(idOf(row));if(!forest)throw Error('Запись не привязана к лесничеству в Transfer');return forest;};
 const key=row=>['POS','LESN','KV','KGLF','VD'].map(k=>row[k]??'').join('::');const stands=new Map(),quarterKeys=new Set();
 for(const raw of tables['Квартал']||[]){const row=copy(raw),f=owner(row);if(!/^\d+$/.test(String(row.KV))||Number(row.KV)<1)throw Error('Неверный номер квартала');const qKey=[row.POS,row.LESN,row.KV,row.KGLF??'',row.Klxr??'',row.Fzona??''].join('::');if(quarterKeys.has(qKey))throw Error('Дублируется квартал по категории лесного фонда');quarterKeys.add(qKey);const q=f.quarters[String(Number(row.KV))]??={quarterRows:[],compartments:[]};q.quarterRows.push(row);}
 for(const raw of tables['Выдел']){const row=copy(raw),f=owner(row);if(!/^\d+$/.test(String(row.KV))||Number(row.KV)<1||row.VD==null||typeof row.VD==='object'||String(row.VD).trim()===''||!Number.isFinite(Number(row.PLV))||Number(row.PLV)<=0)throw Error('Проверьте номер квартала, выдела и площадь в Transfer');row.KV=Number(row.KV);row.VD=String(row.VD);const k=key(row);if(stands.has(k))throw Error('Дублируется полный адрес выдела в Transfer');if(Object.keys(row._children||{}).some(m=>(tables[m]||[]).length))throw Error('Файл одновременно содержит вложенные макеты и отдельные таблицы. Используйте экспорт Transfer без дублирования');row._children=row._children||{};stands.set(k,row);const q=f.quarters[String(row.KV)]??={quarterRows:[],compartments:[]};if(!q.quarterRows.some(x=>String(x.KGLF??'')===String(row.KGLF??'')))q.quarterRows.push({POS:row.POS,LESN:row.LESN,KV:row.KV,KGLF:row.KGLF??null});q.compartments.push(row);}
 for(const [name,rows]of Object.entries(tables)){if(!/^Макет\d+$/.test(name))continue;if(!Array.isArray(rows))throw Error('Неверная таблица '+name);if(!D.transfSchema[name])throw Error('Таблица '+name+' пока не поддерживается; импорт остановлен без потери данных');for(const raw of rows){const row=copy(raw);let target=stands.get(key(row));if(!target&&row.KGLF==null){const matches=[...stands.values()].filter(r=>['POS','LESN','KV','VD'].every(k=>String(r[k])===String(row[k])));if(matches.length===1)target=matches[0];}if(!target)throw Error('Строка '+name+' не связана с единственным выделом');(target._children[name]??=[]).push(row);}}
 for(const [name,rows]of Object.entries(tables)){if(['Лесничество','Квартал','Выдел'].includes(name)||/^Макет\d+$/.test(name))continue;if(!Array.isArray(rows))throw Error('Неверная таблица '+name);for(const forest of groups.values()){const selected=rows.filter(r=>r.POS==null||r.LESN==null||idOf(r)===forest.id);(forest.extraTables??={})[name]=copy(selected);}}if(!groups.size)throw Error('В файле нет лесничеств');return [...groups.values()];}
async function importTransfer(payload,options={}){
 // Persist first so multi-device merge sees the latest locally edited stands.
 await persist();
 const groups=previewTransfer(payload),existing=await list(),merged=[];
 for(const group of groups){
  const prior=existing.find(f=>f.id===group.id);
  if(!prior){merged.push(group);continue;}
  if(options.merge){
   if(!window.SolinTransferMerge?.mergeForest)
    throw Error('Модуль безопасного объединения Transfer отсутствует');
   merged.push(window.SolinTransferMerge.mergeForest(prior,group).forest);
  }else if(options.replace)merged.push(group);
  else throw Error('Такое лесничество уже существует. Выберите «Добавить данные» или сохраните резервную копию перед заменой.');
 }
 // All conflicts are checked before the first IndexedDB write.
 await putMany(merged);
 if(merged.some(g=>g.id===activeId)){
  const currentId=activeId;
  activeId=null; // never persist stale in-memory data over imported records
  await activate(currentId);
 }
 await home();
 return merged;
}
async function importFile(file){if(!file)return;openModal('Чтение Transfer','<p>Читаю файл на этом устройстве…</p>');try{await persist();const payload=await SolinTransferReader.read(file),groups=previewTransfer(payload),existing=await list(),conflicts=groups.filter(g=>existing.some(f=>f.id===g.id));openModal('Загрузка Transfer','<p>Файл: '+html(file.name)+'. Данные остаются на устройстве.</p>'+groups.map(f=>'<article class="transfer-preview"><h3>'+html(f.org.NOS)+'</h3><p>'+html(f.org.NLX)+'</p><small>'+Object.keys(f.quarters).length+' кварталов · '+Object.values(f.quarters).reduce((n,q)=>n+q.compartments.length,0)+' выделов</small></article>').join('')+(conflicts.length?'<p class="import-warning">Совпадает адрес лесничества: '+conflicts.map(f=>html(f.org.NOS)).join(', ')+'. Можно добавить непересекающиеся выделы либо заменить весь набор. При конфликте карточек добавление будет отменено.</p>'+conflicts.map(f=>'<button class="saveConflictBackup" data-forest="'+html(f.id)+'">Копия: '+html(f.org.NOS)+'</button>').join('')+'':'<p>Новые лесничества появятся в списке. Остальные сохранятся.</p>')+'<div class="formActions"><button onclick="closeModal()">Отмена</button>'+(conflicts.length?'<button id="mergeTransfer" type="button">Добавить данные в лесничество</button>':'')+'<button id="acceptTransfer" class="primary">'+(conflicts.length?'Заменить указанные лесничества':'Добавить лесничества')+'</button></div><p id="transferError" role="alert"></p>');for(const b of document.querySelectorAll('.saveConflictBackup'))b.onclick=()=>{const f=existing.find(x=>x.id===b.dataset.forest),u=URL.createObjectURL(new Blob([JSON.stringify(checkpointFor(f),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='SOLIN-backup-'+f.org.POS+'-'+f.org.LESN+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);};
 const mergeButton=document.querySelector('#mergeTransfer');
 if(mergeButton)mergeButton.onclick=async()=>{
  mergeButton.disabled=true;
  try{
   const imported=await importTransfer(payload,{merge:true});
   closeModal();
   toast('Transfer объединены: '+imported.map(g=>g.org.NOS).join(', ')+'. Экспорт MDB создаст один файл лесничества.');
  }catch(err){
   const status=document.querySelector('#transferError');
   if(status)status.textContent=err.message||'Конфликт объединения';
   mergeButton.disabled=false;
  }
 };
 document.querySelector('#acceptTransfer').onclick=async()=>{const b=document.querySelector('#acceptTransfer');b.disabled=true;try{await importTransfer(payload,{replace:!!conflicts.length});
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
function ensureForestSelectorButton(){
 // V51+ main menu is assembled separately from the forestry chooser.
 // Keep a guaranteed, clickable route to the local list of workspaces.
 const root=document.querySelector('#mainScreen');
 if(!root||document.getElementById('solin-switch-forest'))return;
 const host=root.querySelector('.field-context')||root.querySelector('.workspace');
 if(!host)return;
 const button=document.createElement('button');
 button.type='button';button.id='solin-switch-forest';button.className='menuRow solin-switch-forest';
 button.textContent='Выбрать или сменить лесничество';
 button.title='Показать все лесничества, сохранённые на этом планшете';
 button.style.cssText='display:block;width:100%;min-height:44px;margin:10px 0;padding:9px;border:1px solid #9eb4a0;border-radius:8px;background:#f8fcf8;color:#155138;cursor:pointer;font-weight:700';
 button.onclick=()=>home().catch(e=>toast(e.message));
 host.append(button);
}
function bind(){
 const actions=document.querySelector('#menuScreen .workspace');
 if(actions&&!document.getElementById('solin-forest-transfer')){
  const transfer=document.createElement('button');
  transfer.id='solin-forest-transfer';transfer.className='menuRow';transfer.type='button';
  transfer.innerHTML='<span><b>Перенести лесничество на другое устройство</b><small>Скачать всю базу с кварталами, выделами и макетами в JSON</small></span><span>↓</span>';
  transfer.onclick=()=>{try{exportForest();}catch(e){toast(e.message);}};
  const before=actions.querySelector('#solin-mdb-export');
  if(before)before.before(transfer);else actions.append(transfer);
 }
 const newButton=document.querySelector('#newForestButton');if(newButton)newButton.onclick=newForest;// A real full-size file input sits over the visual Transfer button.
 // This avoids iOS/Safari rejecting a scripted click on a hidden input.
 const nativePicker=document.querySelector('#transferForestInput');
 // The native input is inside the styled label. The physical tap goes to the input,
 // so no synthetic click is needed (and no duplicate chooser can be opened).
 if(nativePicker)nativePicker.onchange=e=>{
   const file=e.currentTarget.files?.[0];
   e.currentTarget.value=''; // selecting the same MDB again must still fire change
   if(!file)return; // Cancelled the native picker: never import stale data.
   const status=document.querySelector('#forestListStatus');
   if(status)status.textContent='Выбран файл: '+file.name+'. Проверяю Transfer…';
   void importFile(file);
 };
 const homeButton=document.querySelector('#homeButton');
 if(homeButton)homeButton.onclick=()=>activeId?show(document.getElementById('mainScreen')?'mainScreen':'quartersScreen'):home().catch(e=>toast(e.message));
 ensureForestSelectorButton();
 const old=window.show;window.show=function(id){if(!initialized&&id!=='homeScreen'){return old('homeScreen');}document.body.classList.toggle('workspace-home',id==='homeScreen');old(id);};
 window.addEventListener('solin-saved',()=>persist().catch(e=>toast('Не удалось сохранить лесничество: '+e.message)));
 const prevBackup=window.solinCore.commitImport;window.solinCore.commitImport=function(x){if(x.lesnichestvo?.[0]&&idOf(x.lesnichestvo[0])!==activeId)throw Error('Эта копия относится к другому лесничеству. Загрузите её через главное окно');const result=prevBackup(x);persist().catch(e=>toast(e.message));return result;};
}
async function init(){
 try{
  bind();
  // Retain a read-only recovery candidate BEFORE changing any loaded records.
  // This is the bundled/reference forest, not a replacement for user edits.
  if(D?.lesnichestvo?.[0]&&Object.keys(D.quarters||{}).length){
   const org=copy(D.lesnichestvo[0]);
   sourceFallback={id:idOf(org),org,quarters:copy(D.quarters),
    source:copy(D.source||{}),extraTables:copy(D._transferExtras||{}),
    history:[],updatedAt:new Date().toISOString()};
  }
  let forests=await list();
  // Recover a genuine V50–V52 checkpoint first; never overwrite a newer
  // IndexedDB forest with an older localStorage record.
  let recovery=null;
  try{recovery=JSON.parse(localStorage.getItem(CHECKPOINT)||'null');}catch(e){
   console.warn('Не удалось прочитать контрольную копию лесничества',e);
  }
  if(recovery?.lesnichestvo?.[0]&&recovery.quarters){
   const org=recovery.lesnichestvo[0],id=idOf(org),stored=forests.find(f=>f.id===id);
   if(!stored||Date.parse(recovery.at||0)>Date.parse(stored.updatedAt||0)){
    await putMany([{id,org:copy(org),quarters:copy(recovery.quarters),
     extraTables:copy(recovery.extraTables||{}),source:copy(recovery.source||{}),
     history:copy(recovery.history||[]),updatedAt:recovery.at||new Date().toISOString()}]);
    forests=await list();
   }
  }
  // First installation: preserve original bundled forest and save its
  // full address and quarter dataset. Do NOT re-seed after intentional delete.
  if(!forests.length&&!localStorage.getItem(INITIALIZED)&&sourceFallback){
   await putMany([copy(sourceFallback)]);
   forests=await list();
  }
  localStorage.setItem(INITIALIZED,'1');
  initialized=true;
  if(!forests.length){
   activeId=null;opened=false;
   // Never remove checkpoint/legacy storage or clear D on a failed migration.
   await showHome();
   window.dispatchEvent(new Event('solin-workspaces-ready'));
   document.dispatchEvent(new Event('solin-workspaces-ready'));
   return;
  }
  try{forests=await restoreSourceFields(forests);}catch(e){
   console.warn('Восстановление полей пропущено без удаления рабочих данных',e);
   forests=await list();
  }
  const last=forests.find(r=>r.id===localStorage.getItem(ACTIVE))||forests[0];
  activeId=null; // prevent persisting loaded starter data over the workspace
  await activate(last.id);
  // Startup should land on the real main menu, not the forestry chooser.
  window.dispatchEvent(new Event('solin-workspaces-ready'));
  document.dispatchEvent(new Event('solin-workspaces-ready'));
 }catch(e){
  console.error('Не удалось запустить лесничество',e);
  const status=document.querySelector('#forestListStatus');
  if(status)status.textContent='Ошибка запуска: '+e.message+'. Сохранённые данные не удалялись.';
  initialized=true;
  throw e;
 }
}
let readyResolve,readyReject;const ready=new Promise((r,j)=>{readyResolve=r;readyReject=j});
window.SolinWorkspace={list,activate,create,deleteForest,deleteQuarter,deleteStand,previewTransfer,importTransfer,persist,exportForest,home,importFile,downloadSourceRecoveryBackup,repairAddressCodes,get activeId(){return activeId},ready};
window.addEventListener('solin-ready',()=>init().then(readyResolve,readyReject),{once:true});
})();

