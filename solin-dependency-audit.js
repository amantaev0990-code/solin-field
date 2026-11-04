/* Separate read-only audit for the currently loaded SOLI-N Field workspace.
 * This is NOT the complete original Access validation suite: only precisely
 * ported source-backed RowSource dependencies are checked. */
(()=>{'use strict';
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const address=r=>[r.POS,r.LESN,r.KV,r.KGLF,r.VD].map(x=>String(x??'?')).join('/');
// Whole-card integrity on top of the source-backed dropdown rules.
// Audit is read-only: an old imported inconsistency must be reported,
// not silently rewritten during an unrelated field edit.
function checkOne(record,org,refs){
 const audit=window.SolinDependentRules?.validateTransition?.(
  null,record,org,refs,{isNew:true})||{errors:[],warnings:[]};
 const errors=[...audit.errors],warnings=[...audit.warnings];
 const flag=(hard,form,field,value,reason,index=null)=>
  (hard?errors:warnings).push({form,field,index,value:String(value??''),reason});
 const database=typeof D!=='undefined'?D:window.D;
 const quarter=database?.quarters?.[String(record?.KV)];
 const quarterRows=quarter&&(window.SolinAddressContext?.quarterRows?.(quarter)||
  (quarter.quarterRows?.length?quarter.quarterRows:[quarter.meta]));
 if(database?.quarters){
  if(!quarter)flag(true,'Квартал','KV',record?.KV,'Выдел ссылается на отсутствующий квартал');
  else{
   const matches=(quarterRows||[]).filter(q=>
    ['POS','LESN','KV','KGLF'].every(k=>q?.[k]==null||record?.[k]==null||
      String(q[k]).trim()===String(record[k]).trim()));
   if(matches.length!==1)
    flag(matches.length===0,'Квартал','KGLF',record?.KGLF,
     matches.length===0?'Квартал не содержит категорию ГЛФ этого выдела':
     'Адрес квартала неоднозначен: '+matches.length+' строк с той же категорией');
   if(matches.length===1){
    const q=matches[0];
    if(q.Fzona!=null&&record.Fzona!=null&&String(q.Fzona)!==String(record.Fzona))
     flag(false,'ВыделВ','Fzona',record.Fzona,'Функциональная зона выдела отличается от исходной строки квартала');
    if(q.Klxr!=null&&record.KlxrVD!=null&&String(q.Klxr)!==String(record.KlxrVD))
     flag(false,'ВыделВ','KlxrVD',record.KlxrVD,'Зона выдела отличается от зоны квартала: проверьте индивидуальное назначение');
    const geo=window.SolinQuarterPickers?.validateDistrict?.(q.Raion,org);
    if(geo?.status==='mismatch'||geo?.status==='invalid')
     flag(true,'Квартал','Raion',q.Raion,geo.reason);
    else if(geo?.status==='unknown'&&q.Raion!=null)
     flag(false,'Квартал','Raion',q.Raion,geo.reason);
   }
  }
 }
 for(const [form,rows] of Object.entries(record?._children||{})){
  if(!/^Макет\d+$/.test(form)||!Array.isArray(rows))continue;
  for(let i=0;i<rows.length;i++)
   for(const key of ['POS','LESN','KV','KGLF','VD']){
    const value=rows[i]?.[key],parent=record[key];
    if(value!=null&&String(value).trim()!==''&&parent!=null&&
       String(value).trim()!==String(parent).trim())
     flag(true,form,key,value,'Строка макета ссылается на другой адрес выдела '+key,i);
   }
 }
 const stock=window.SolinCardCalculations?.standStock?.(record);
 if(stock?.status==='ambiguous')
  flag(true,'Макет10','ZAP',record?.STUR1,stock.reason||'Запас яруса неоднозначен');
 else if(stock?.status==='waiting'&&record?._children?.Макет10?.length)
  flag(false,'Макет10','ZAP',record?.STUR1,stock.reason||'Запас не может быть проверен из введённых значений');
 return {address:address(record),errors,warnings};
}
function coverage(){
 const summary=window.SOLIN_AUDIT?.summary||{};
 const refTables=window.SOLIN_REFS?.tables||{};
 return {archivedForms:summary.formCount??null,
  archivedRowSources:summary.rowSources??null,
  archivedValidationRules:summary.validationRules??null,
  availableReferenceTables:Object.keys(refTables).length,
  districtOriginalTableAvailable:Boolean(refTables['Кл_Рай']),
  sourceCoverage:'partial',
  note:'Проверяются только реализованные источники и межтабличная целостность. Это не полное выполнение всех Access SQL/VBA правил.'};
}
function scan(records,org,refs){
 const list=Array.isArray(records)?records:[],results=list.map(r=>checkOne(r,typeof org==='function'?org(r):org,refs));
 return {records:results.length,errors:results.reduce((n,r)=>n+r.errors.length,0),
  warnings:results.reduce((n,r)=>n+r.warnings.length,0),
  affected:results.filter(r=>r.errors.length||r.warnings.length).length,
  results:results.filter(r=>r.errors.length||r.warnings.length)};
}
// CSV is a tabular complement to the lossless JSON audit. Semicolon and
// UTF-8 BOM keep Russian field names usable in standard Excel settings.
// Escape potential spreadsheet formulas in *all* user-derived cells.
function csv(report){
 const cells=[['Лесничество/квартал/выдел','Статус','Форма','Поле',
  'Номер строки','Код','Причина']];
 for(const r of report?.results||[]){
  for(const [type,records] of [['Ошибка',r.errors||[]],['Не подтверждено',r.warnings||[]]]){
   for(const issue of records){
    cells.push([r.address,type,issue.form,issue.field,
     Number.isInteger(issue.index)?issue.index+1:'',issue.value,issue.reason]);
   }
  }
 }
 const quote=value=>{
  let v=String(value??'');
  // Excel formula injection can begin with =,+,-,@ or leading control space.
  if(/^[\s]*[=+@-]/.test(v))v="'"+v;
  return '"'+v.replace(/"/g,'""')+'"';
 };
 return '\ufeff'+cells.map(row=>row.map(quote).join(';')).join('\r\n')+'\r\n';
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
 const database=typeof D!=='undefined'?D:window.D;
 const batchSize=40,details=[],references=window.SOLIN_REFS?.tables,forests=database?.lesnichestvo||[];
 const orgFor=r=>forests.find(o=>String(o.POS)===String(r.POS)&&String(o.LESN)===String(r.LESN))||{};
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
  const report={version:'SOLIN-Field-Dependency-Audit-v2',coverage:coverage(),scope:opts.caption||'Лесничество',
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
   '<div class="formActions"><button type="button" id="wfSaveDependencyAudit">Скачать JSON</button>'+
   '<button type="button" id="wfSaveDependencyCsv">Скачать таблицу CSV</button>'+
   '<button type="button" class="primary" id="wfCloseDependencyAudit">Закрыть</button></div>';
  host.querySelector('#wfSaveDependencyAudit').onclick=()=>{
   const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='solin-dependent-audit.json';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),5000);
  };
  host.querySelector('#wfSaveDependencyCsv').onclick=()=>{
   const blob=new Blob([csv(report)],{type:'text/csv;charset=utf-8'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='solin-dependent-audit.csv';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),5000);
  };
  host.querySelector('#wfCloseDependencyAudit').onclick=()=>window.closeModal?.();
 };
 step();
}
window.SolinDependencyAudit={checkOne,scan,csv,open,coverage};
})();
