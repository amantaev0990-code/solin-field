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
      const blank = await packagedTemplate();
      modal('Экспорт MDB','<p>Создаю MDB на телефоне. После проверки откроется выбор папки для сохранения.</p>');
      await plugin().export({
        templateBase64:base64(blank),
        transferJson:JSON.stringify(transfer)
      });
      modal('Экспорт завершён',
        '<p>Файл <b>Transf_'+esc(transfer.identity.POS)+'_'+esc(transfer.identity.LESN)+'_'+
        esc(transfer.identity.GodT)+'.mdb</b> сохранён в выбранной папке.</p>'+
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
  window.SolinOfflineMDB={exportMDB,readStored,saveStored};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
