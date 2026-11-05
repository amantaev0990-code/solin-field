/* SOLI-N Field: one export action, common Transfer snapshot, native Android MDB writer.
 * No server/ZIP dependency. Browser Safari writer requires separate validated implementation. */
(() => {
  'use strict';
  const IDB = 'solin-offline-mdb-templates-v1';
  const esc = text => String(text??'').replace(/[&<>"']/g, x =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const keyOf = id => [id.POS,id.LESN,id.GodT].join('::');
  const isJet = bytes => {
    const b = new Uint8Array(bytes,0,Math.min(32,bytes.byteLength));
    return b.length>=32 && 'Standard Jet DB' ===
      String.fromCharCode(...b.slice(4,19));
  };
  function openDB(){
    return new Promise((ok,bad)=>{
      const r=indexedDB.open(IDB,1);
      r.onupgradeneeded=()=>r.result.createObjectStore('files');
      r.onsuccess=()=>ok(r.result);
      r.onerror=()=>bad(r.error);
    });
  }
  async function readStored(id){
    const db=await openDB();
    try {return await new Promise((ok,bad)=>{
      const tx=db.transaction('files','readonly'),req=tx.objectStore('files').get(id);
      req.onsuccess=()=>ok(req.result||null);req.onerror=()=>bad(req.error);
    });}finally{db.close();}
  }
  async function saveStored(id,data){
    const db=await openDB();
    try {await new Promise((ok,bad)=>{
      const tx=db.transaction('files','readwrite');
      tx.objectStore('files').put(data,id);tx.oncomplete=ok;
      tx.onerror=()=>bad(tx.error);tx.onabort=()=>bad(tx.error);
    });}finally{db.close();}
  }
  async function deleteStored(id){
    const db=await openDB();
    try {await new Promise((resolve,reject)=>{
      const tx=db.transaction('files','readwrite');
      tx.objectStore('files').delete(id);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||Error('Не удалось удалить сохранённый MDB'));
      tx.onabort=()=>reject(tx.error||Error('Удаление MDB отменено'));
    });}finally{db.close();}
  }
  const android = () => window.Capacitor?.getPlatform?.()==='android' &&
    window.Capacitor?.isNativePlatform?.();
  const plugin = () => window.Capacitor?.Plugins?.SolinMdb;
  const button = () => document.getElementById('solin-mdb-export');
  const modal = (title,html)=> {
    if(typeof openModal!=='function')throw Error('Экран экспорта не загрузился.');
    openModal(title,html);
  };
  function base64(buffer){
    const b=new Uint8Array(buffer);
    let text='';
    for(let i=0;i<b.length;i+=8192){
      text+=String.fromCharCode.apply(null,b.subarray(i,i+8192));
    }
    return btoa(text);
  }
  async function packagedTemplate() {
    // Shipped as a validated, data-free 18-table Jet MDB app asset.
    // Never ask field staff to upload or select a source database.
    const response = await fetch('./vendor/solin-empty-transfer-v20261028-27.mdb');
    if (!response.ok) throw Error('В сборке APK отсутствует пустой MDB-шаблон.');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength<1024 || bytes.byteLength>12000000 || !isJet(bytes))
      throw Error('Встроенный MDB-шаблон повреждён.');
    return bytes;
  }
  // Check the REAL selected forest, not only the Jet binary header.
  // A desktop SOLI-N query can silently hide a quarter whose address is incomplete.
  function validateTransferRows(transfer){
    const tables=transfer?.tables||{}, owner=transfer.identity||{};
    const qs=tables['Квартал'], stands=tables['Выдел'], forests=tables['Лесничество'];
    if(!Array.isArray(qs)||!Array.isArray(stands)||!Array.isArray(forests)||forests.length!==1)
      throw Error('В MDB отсутствуют данные лесничества, кварталов или выделов.');
    if(typeof D==='undefined'||!D?.quarters||!D?.lesnichestvo?.length)
      throw Error('Лесничество не открыто для экспорта.');
    const actualQuarters=Object.values(D.quarters).reduce((n,q)=>n+(q.quarterRows?.length||1),0);
    const actualStands=Object.values(D.quarters).reduce((n,q)=>n+(q.compartments?.length||0),0);
    if(actualQuarters!==qs.length||actualStands!==stands.length)
      throw Error('Экспорт подготовил не все кварталы или выделы: '+actualQuarters+'/'+actualStands+
        ' в Field, '+qs.length+'/'+stands.length+' в Transfer.');
    const key=(r)=>[Number(r.POS),Number(r.LESN),Number(r.KV),Number(r.KGLF)].join(':');
    const addresses=new Set();
    for(const q of qs){
      if(Number(q.POS)!==Number(owner.POS)||Number(q.LESN)!==Number(owner.LESN)||
         !Number.isSafeInteger(Number(q.KV))||Number(q.KV)<1)
        throw Error('Квартал имеет неверный адрес лесничества.');
      if(!Number.isSafeInteger(Number(q.KGLF))||Number(q.KGLF)<1)
        throw Error('Квартал '+q.KV+': не указана категория ГЛФ. Укажите её в карточке квартала и повторите экспорт.');
      if(!Number.isSafeInteger(Number(q.GodT))||Number(q.GodT)<1900)
        throw Error('Квартал '+q.KV+': не указан год таксации.');
      addresses.add(key(q));
    }
    for(const stand of stands){
      if(!addresses.has(key(stand))||!Number.isSafeInteger(Number(stand.VD))||
         Number(stand.VD)<1||!(Number(stand.PLV)>0))
        throw Error('Выдел '+(stand.VD??'?')+' в квартале '+(stand.KV??'?')+
          ' не связан с корректной строкой квартала (категория ГЛФ/адрес/площадь).');
    }
    return {quarters:qs.length,stands:stands.length};
  }
  async function exportMDB(){
    const b=button();
    if(b)b.disabled=true;
    try{
      if(!android()){
        modal('Экспорт MDB',
          '<p>Настоящий MDB без интернета пока реализуется только для Android APK. '+
          'В Safari на iPhone механизм записи Jet ещё проходит разработку. '+
          'JSON или ZIP вместо MDB приложение выдавать не будет.</p>'+
          '<button type="button" onclick="closeModal()">Закрыть</button>');
        return;
      }
      if(!plugin()||typeof plugin().export!=='function'){
        throw Error('Нативный модуль MDB отсутствует в этой сборке APK.');
      }
      await window.SolinWorkspace?.ready;
      await window.SolinWorkspace?.persist?.();
      const transfer=window.SolinMDBBridge?.snapshot?.();
      if(!transfer||transfer.format!=='SOLIN-MDB-Bridge-v1')throw Error('Не удалось собрать карточки Transfer.');
      const counts = validateTransferRows(transfer);
      const blank = await packagedTemplate();
      modal('Экспорт MDB','<p>Создаю и проверяю MDB. На Android 10+ файл будет сохранён в «Загрузки/SOLI-N Field».</p>');
      const result = await plugin().export({
        templateBase64:base64(blank),
        transferJson:JSON.stringify(transfer)
      });
      if(result?.saved !== true || result?.verified !== true ||
         !Number.isSafeInteger(result?.bytes) || result.bytes < 2048)
        throw Error('Android не подтвердил размер и целостность MDB. Не используйте полученный файл.');
      const size = (result.bytes / 1024).toFixed(1);
      const expectedName = 'Transf_'+transfer.identity.POS+'_'+transfer.identity.LESN+'_'+transfer.identity.GodT+'.mdb';
      const actualName = result.name || expectedName;
      modal('Экспорт завершён',
        '<p>Файл <b>'+esc(actualName)+'</b> сохранён в '+esc(result.folder||'выбранной папке')+'.</p>'+
        '<p><b>Размер: '+size+' КБ.</b> Файл повторно считан и проверен.</p>'+
        '<p><b>Записи:</b> '+counts.quarters+' кварталов, '+counts.stands+' выделов.</p>'+
        '<p>Перед использованием в работе откройте его на настольном SOLI-N в тестовой базе.</p>'+
        '<button type="button" onclick="closeModal()">Готово</button>');
    }catch(e){
      modal('MDB не создан',
        '<p role="alert">'+esc(e?.message||'Ошибка локального экспорта')+'</p>'+
        '<p>Карточки приложения и исходный шаблон не изменены.</p>'+
        '<button type="button" onclick="closeModal()">Закрыть</button>');
    }finally{if(b)b.disabled=false;}
  }
  function install(){
    const b=button();if(!b)return;
    b.innerHTML='<span><b>Экспорт</b><small>Создание MDB без сервера (APK Android)</small></span><span>⇩</span>';
    b.type='button';b.onclick=exportMDB;
  }
  window.SolinOfflineMDB={exportMDB,readStored,saveStored,deleteStored};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
