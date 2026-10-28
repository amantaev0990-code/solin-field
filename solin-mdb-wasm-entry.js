/* SOLI-N Field | Single Export entry.
 * On iOS/web, the on-device WebAssembly writer reads the active IndexedDB
 * forest. Android keeps its native plugin. No extra menu entries or dialogs. */
(() => {
 'use strict';
 const ID='solin-mdb-export';
 const onAndroid=()=>window.Capacitor?.isNativePlatform?.() &&
   window.Capacitor?.getPlatform?.()==='android';
 function install(){
   // Remove the old proof-of-concept menu entry on upgrades.
   document.getElementById('solin-mdb-wasm-test')?.remove();
   if(onAndroid())return;
   const button=document.getElementById(ID);
   if(!button)return;
   button.type='button';
   const idle='<span><b>Экспорт</b><small>Сохранить базу в формате MDB</small></span><span>⇩</span>';
   button.innerHTML=idle;
   button.onclick=async()=>{
     if(button.disabled)return;
     button.disabled=true;
     button.innerHTML='<span><b>Подготавливаю MDB…</b></span><span>⇩</span>';
     try{
       const workspaces=window.SolinWorkspace;
       if(!workspaces?.ready || !workspaces?.persist)
         throw Error('Локальная база лесничества не готова.');
       await workspaces.ready;
       if(!workspaces.activeId)
         throw Error('Сначала откройте лесничество в SOLI-N Field.');
       await workspaces.persist();
       const payload=window.SolinMDBBridge?.snapshot?.();
       const identity=payload?.identity;
       if(payload?.format!=='SOLIN-MDB-Bridge-v1' || !identity)
         throw Error('Не удалось подготовить данные Transfer.');
       const forestId=String(identity.POS)+'::'+String(identity.LESN);
       if(forestId!==workspaces.activeId)
         throw Error('Адрес открытого лесничества не совпал с данными Transfer.');
       if(Object.keys(payload.tables||{}).length!==18)
         throw Error('Есть дополнительные таблицы, ещё не поддерживаемые MDB-конвертером. Экспорт отменён без потери данных.');
       const url=new URL('mdb-wasm-poc/',document.baseURI);
       url.searchParams.set('export','1');
       url.searchParams.set('forest',forestId);
       window.location.assign(url.href);
     }catch(error){
       button.disabled=false;
       button.innerHTML=idle;
       if(typeof toast==='function')toast(error?.message||'Ошибка экспорта.');
       else alert(error?.message||'Ошибка экспорта.');
     }
   };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
})();
