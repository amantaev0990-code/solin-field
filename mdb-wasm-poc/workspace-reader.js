/* SOLI-N Field → isolated .NET MDB writer (read-only bridge).
 * Same-origin IndexedDB is read only. Never create, alter, or upload forestry
 * data. Only fetches PUBLIC schema, then uses existing SOLI-N bridge to match
 * the exact snapshot format used in Field.
 */
(() => {
  'use strict';
  const WORKSPACES='SOLIN_WORKSPACES_V1';
  const ACTIVE='solin_active_forest_v1';
  const loadBridge=()=>{
    if(window.SolinMDBBridge?.snapshot)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const node=document.createElement('script');
      node.src='../solin-mdb-bridge.js';
      node.onload=()=>window.SolinMDBBridge?.snapshot?resolve():reject(Error('Не загружен формат Transfer.'));
      node.onerror=()=>reject(Error('Не удалось загрузить описание Transfer.'));
      document.head.appendChild(node);
    });
  };
  async function currentWorkspace(){
    return new Promise((resolve,reject)=>{
      const open=indexedDB.open(WORKSPACES);
      open.onerror=()=>reject(Error('Не удалось открыть локальные данные лесничества.'));
      open.onsuccess=()=>{
        const db=open.result;
        if(!db.objectStoreNames.contains('forests')){
          db.close();reject(Error('Сохранённое лесничество не найдено. Откройте сначала SOLI-N Field.'));return;
        }
        const tx=db.transaction('forests','readonly');
        const request=tx.objectStore('forests').getAll();
        request.onsuccess=()=>{
          const forests=request.result||[];
          const active=localStorage.getItem(ACTIVE);
          // Never silently export the first stored forestry if the active ID
          // is absent or stale: the MDB filename must represent the exact
          // user-selected owner/district, not an arbitrary IndexedDB record.
          const selected=active && forests.find(f=>f.id===active);
          db.close();
          if(!active) {
            reject(Error('Не выбрано активное лесничество. Вернитесь в SOLI-N Field и откройте нужное.'));
          } else if(!selected) {
            reject(Error('Выбранное лесничество не найдено. Откройте его заново в SOLI-N Field.'));
          } else if(!selected.org || selected.id!==String(selected.org.POS)+'::'+String(selected.org.LESN)) {
            reject(Error('Адрес сохранённого лесничества повреждён. Экспорт остановлен.'));
          } else {
            resolve(selected);
          }
        };
        request.onerror=()=>{db.close();reject(Error('Не удалось прочитать карточки из памяти телефона.'));};
      };
    });
  }
  window.solinGetTransferJson=async function(){
    const selected=await currentWorkspace();
    const expectedForest=new URL(location.href).searchParams.get('forest');
    if(expectedForest && expectedForest!==selected.id)
      throw Error('Выбрано другое лесничество. Вернитесь в SOLI-N Field и повторите экспорт.');
    const response=await fetch('../data-meta.json',{cache:'force-cache'});
    if(!response.ok)throw Error('Описание полей SOLI-N недоступно.');
    const meta=await response.json();
    window.D={
      transfSchema:meta.transfSchema,
      lesnichestvo:[selected.org],
      quarters:selected.quarters,
      _transferExtras:selected.extraTables||{},
      source:selected.source||{}
    };
    await loadBridge();
    const transfer=window.SolinMDBBridge.snapshot();
    if(Object.keys(transfer.tables||{}).length!==18)
      throw Error('Сохранённая база содержит дополнительные таблицы, для которых нет MDB-шаблона. Экспорт остановлен без потерь.');
    if(!transfer.tables['Лесничество']?.length||!transfer.tables['Выдел']?.length)
      throw Error('В выбранном лесничестве нет карточек таксации.');
    return JSON.stringify(transfer);
  };
})();
