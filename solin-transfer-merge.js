/* SOLI-N Field V52 — additive, local-only Transfer merger.
 * The same POS/LESN forest may be filled by multiple independent taxators.
 * Never silently replace an edited stand, change a taxator's source data,
 * or delete a field. A conflict aborts the WHOLE merge.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SolinTransferMerge=api;
})(typeof window!=='undefined'?window:undefined,function(){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const code=v=>String(v??'').trim();
 const addressKeys=['POS','LESN','KV','KGLF','VD'];
 const standKey=r=>addressKeys.map(k=>code(r[k])).join('::');
 const qKey=r=>['POS','LESN','KV','KGLF','Fzona','Klxr'].map(k=>code(r[k])).join('::');
 const ordered=v=>{
  if(Array.isArray(v))return v.map(ordered);
  if(v&&typeof v==='object'){
   const o={};
   for(const k of Object.keys(v).sort())if(!['_local','_dirty','_selected'].includes(k))o[k]=ordered(v[k]);
   return o;
  }
  return v;
 };
 const equal=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
 const fail=(messages)=>{
  const issue=messages[0]||'неизвестная ошибка';
  const error=Error('Объединение отменено: '+messages.length+' конфликт(ов). Первый: '+issue+'. '
    +'Данные обоих устройств сохранены. Проверьте пересекающиеся выделы, не заменяйте их автоматически.');
  error.conflicts=messages;throw error;
 };
 function mergeForest(existing,incoming){
  if(!existing?.org||!incoming?.org||!existing?.quarters||!incoming?.quarters)
    throw Error('Объединение: неполные данные лесничества.');
  if(code(existing.org.POS)!==code(incoming.org.POS)||code(existing.org.LESN)!==code(incoming.org.LESN))
    throw Error('Нельзя объединять разные лесничества (POS/LESN).');
  if(Number(existing.org.GodT)!==Number(incoming.org.GodT))
    throw Error('Разные годы таксации. Объединение остановлено без изменения базы.');
  const output=clone(existing),errors=[],stats={addedQuarters:0,addedQuarterRows:0,addedStands:0,identicalStands:0,addedExtraRows:0};
  for(const [number,sourceQ] of Object.entries(incoming.quarters||{})){
   if(!sourceQ||!Array.isArray(sourceQ.compartments)) {
    errors.push('квартал '+number+': повреждённый список выделов');continue;
   }
   if(!output.quarters[number]){
    output.quarters[number]=clone(sourceQ);
    stats.addedQuarters++;
    stats.addedStands+=sourceQ.compartments.length;
    continue;
   }
   const targetQ=output.quarters[number];
   targetQ.quarterRows??=(targetQ.meta?[clone(targetQ.meta)]:[]);
   const sourceRows=sourceQ.quarterRows?.length?sourceQ.quarterRows:(sourceQ.meta?[sourceQ.meta]:[]);
   const quarters=new Map(targetQ.quarterRows.map(q=>[qKey(q),q]));
   for(const row of sourceRows){
    const prior=quarters.get(qKey(row));
    if(prior){
     if(!equal(prior,row))errors.push('квартал '+number+': различаются сведения категории ГЛФ или функциональной зоны');
    }else{
     targetQ.quarterRows.push(clone(row));quarters.set(qKey(row),row);stats.addedQuarterRows++;
    }
   }
   const stands=new Map(targetQ.compartments.map(r=>[standKey(r),r]));
   for(const raw of sourceQ.compartments){
    const key=standKey(raw),prior=stands.get(key);
    if(prior){
     if(!equal(prior,raw))errors.push('квартал '+number+', выдел '+code(raw.VD)+', КГЛФ '+code(raw.KGLF)+': карточки различаются');
     else stats.identicalStands++;
    }else{
     targetQ.compartments.push(clone(raw));stands.set(key,raw);stats.addedStands++;
    }
   }
  }
  output.extraTables??={};
  for(const [name,rows] of Object.entries(incoming.extraTables||{})){
   if(!Array.isArray(rows)){errors.push('таблица '+name+': повреждена');continue;}
   const target=output.extraTables[name]??=[];
   for(const row of rows){
    if(target.some(previous=>equal(previous,row)))continue;
    // Additional tables might contain several records per stand. Without
    // original PK we cannot choose between overlapping different records.
    const linkedFields=['POS','LESN','KV','KGLF','VD','IAR'].filter(k=>
      row[k]!=null && code(row[k])!=='' );
    const collision=linkedFields.length>=3&&target.some(previous=>
      linkedFields.every(k=>code(previous[k])===code(row[k])));
    if(collision){errors.push('таблица '+name+': разное содержимое одинакового адреса '+linkedFields.map(k=>code(row[k])).join('/'));continue;}
    target.push(clone(row));stats.addedExtraRows++;
   }
  }
  if(errors.length)fail(errors);
  output.updatedAt=new Date().toISOString();
  output.history=[...(output.history||[]),{at:output.updatedAt,reason:
   'Добавление Transfer другого таксатора: +'+stats.addedStands+' выделов, +'+stats.addedQuarters+' кварталов'}].slice(-100);
  return {forest:output,stats};
 }
 return Object.freeze({mergeForest,standKey,qKey});
});
