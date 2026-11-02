/* Separate read-only audit for the currently loaded SOLI-N Field workspace.
 * This is NOT the complete original Access validation suite: only precisely
 * ported source-backed RowSource dependencies are checked. */
(()=>{'use strict';
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const address=r=>[r.POS,r.LESN,r.KV,r.KGLF,r.VD].map(x=>String(x??'?')).join('/');
function checkOne(record,org,refs){
 const audit=window.SolinDependentRules?.validateTransition?.(
  null,record,org,refs,{isNew:true})||{errors:[],warnings:[]};
 return {address:address(record),errors:audit.errors,warnings:audit.warnings};
}
function scan(records,org,refs){
 const list=Array.isArray(records)?records:[],results=list.map(r=>checkOne(r,typeof org==='function'?org(r):org,refs));
 return {records:results.length,errors:results.reduce((n,r)=>n+r.errors.length,0),
  warnings:results.reduce((n,r)=>n+r.warnings.length,0),
  affected:results.filter(r=>r.errors.length||r.warnings.length).length,
  results:results.filter(r=>r.errors.length||r.warnings.length)};
}
function open(records,opts={}){
 if(!window.SolinDependentRules?.validateTransition){
  window.toast?.('Модуль проверки зависимостей не загружен');return;
 }
 if(typeof openModal!=='function')return;
 const collection=Array.isArray(records)?records:[];
 openModal('Проверка взаимосвязей SOLI-N','<div id="solin-dependency-scan">'+
  '<p>Проверяется: '+html(opts.caption||'текущие выделы')+'</p>'+
  '<p data-scan-status role="status">Подготовка проверки…</p></div>');
 const host=document.getElementById('solin-dependency-scan'),status=host?.querySelector('[data-scan-status]');
 if(!host)return;
 const batchSize=40,details=[],references=window.SOLIN_REFS?.tables,forests=window.D?.lesnichestvo||[];
 const orgFor=r=>forests.find(o=>String(o.POS)===String(r.POS)&&String(o.LESN)===String(r.LESN))||forests[0]||{};
 let cursor=0,errors=0,warnings=0,affected=0;
 const step=()=>{
  if(!host.isConnected)return;
  const limit=Math.min(cursor+batchSize,collection.length);
  for(;cursor<limit;cursor++){
   const r=checkOne(collection[cursor],orgFor(collection[cursor]),references);
   errors+=r.errors.length;warnings+=r.warnings.length;
   if(r.errors.length||r.warnings.length){affected++;details.push(r);}
  }
  if(cursor<collection.length){
   status.textContent='Проверено '+cursor+' из '+collection.length+' выделов';
   setTimeout(step,0);return;
  }
  const report={version:'SOLIN-Field-Dependency-Audit-v1',scope:opts.caption||'Лесничество',
   generatedAt:new Date().toISOString(),records:collection.length,
   errors,warnings,affected,results:details};
  host.innerHTML='<p>Проверено выделов: <b>'+collection.length+'</b>. Несоответствий: <b>'+
   errors+'</b>. Неполностью подтверждённых значений: <b>'+warnings+
   '</b>. Выделов с замечаниями: <b>'+affected+'</b>.</p>'+
   '<p class="wf-form-note">Проверены только зависимости, достоверно перенесённые из Access. Неопознанные условия SQL/VBA не считаются пройденными. Исходные карточки и MDB не менялись.</p>'+
   (details.length?'<div style="max-height:45vh;overflow:auto">'+details.slice(0,120).map(r=>
     '<details><summary>Выдел '+html(r.address)+
     ' · ошибок '+r.errors.length+', непроверенных '+r.warnings.length+'</summary>'+
     [...r.errors.map(e=>({kind:'Ошибка',...e})),
       ...r.warnings.map(e=>({kind:'Не подтверждено',...e}))]
       .map(e=>'<p><b>'+html(e.kind)+' · '+html(e.form)+'.'+html(e.field)+
       (Number.isInteger(e.index)?' · запись '+(e.index+1):'')+
       '</b>: '+html(e.reason)+'</p>').join('')+'</details>').join('')+'</div>':
     '<p>По реализованным правилам несоответствий не найдено.</p>')+
   (details.length>120?'<p>Показаны первые 120 из '+details.length+
      ' выделов с замечаниями. В JSON-отчёте содержатся все.</p>':'')+
   '<div class="formActions"><button type="button" id="wfSaveDependencyAudit">Скачать полный JSON-отчёт</button>'+
   '<button type="button" class="primary" id="wfCloseDependencyAudit">Закрыть</button></div>';
  host.querySelector('#wfSaveDependencyAudit').onclick=()=>{
   const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='solin-dependent-audit.json';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),5000);
  };
  host.querySelector('#wfCloseDependencyAudit').onclick=()=>window.closeModal?.();
 };
 step();
}
window.SolinDependencyAudit={checkOne,scan,open};
})();
