/* Mobile adapter for the audited preparation and six native query groups. */
(()=>{'use strict';
const E=window.SolinControlEngine,N=window.SOLIN_NATIVE_CONTROL_DATA;
const KEY=['POS','LESN','KV','KGLF','VD'],own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const copy=v=>JSON.parse(JSON.stringify(v));
const all=d=>Object.values(d.quarters||{}).flatMap(q=>q.compartments||[]);
const addr=r=>Object.fromEntries(KEY.map(k=>[k,r[k]??null]));
const key=r=>JSON.stringify(KEY.map(k=>r[k]==null?null:String(r[k]).replace(/ +$/,'').toLocaleUpperCase('ru-RU')));
const equal=(a,b)=>a!=null&&b!=null&&String(a).replace(/ +$/,'').toLocaleUpperCase('ru-RU')===String(b).replace(/ +$/,'').toLocaleUpperCase('ru-RU');
const stamp=d=>JSON.stringify([d.quarters,d.lesnichestvo,d._transferExtras]);
const pending=new WeakMap();let sqlPromise,normPromise;
function localDate(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function sql(){return sqlPromise??=(initSqlJs({locateFile:f=>'./vendor/'+f}).catch(e=>{sqlPromise=null;throw e;}));}
async function norms(){return normPromise??=(async()=>{const r=await fetch('./solin-control-norms.json.gz');if(!r.ok)throw Error('Не загрузились исходные нормативные таблицы');const bytes=await r.arrayBuffer();
 if(window.crypto?.subtle){const digest=await crypto.subtle.digest('SHA-256',bytes),actual=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');if(actual!==N.source.normsSha256)throw Error('Нормативные таблицы не соответствуют версии контроля');}
 return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());})().catch(e=>{normPromise=null;throw e;});}
function sourceTables(database,records,settings,reference){
 const tables={...reference},links={};
 tables.Выдел=records.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>!k.startsWith('_'))));
 tables.Квартал=Object.values(database.quarters||{}).flatMap(q=>q.quarterRows?.length?q.quarterRows:q.meta?[q.meta]:[]);
 tables.KUch=(database.lesnichestvo||[]).map(o=>({...o,B:-1}));
 tables.Контроли=N.catalog.map(c=>({...c,Priz:settings[c.code]?.enabled?-1:0,Usl1:settings[c.code]?.Usl1??null,Usl2:settings[c.code]?.Usl2??null}));
 for(const name of N.baseTables){if(/^Макет\d+$/.test(name)){tables[name]=[];links[name]=[];}
  else if(['Памятники','Аренда','АрендаКв'].includes(name))tables[name]=copy(database._transferExtras?.[name]||[]);
 }
 for(let parent=0;parent<records.length;parent++)for(const [name,children]of Object.entries(records[parent]._children||{})){
  if(!tables[name]||!links[name])continue;
  children.forEach((child,row)=>{for(const k of KEY)if(own(child,k)&&child[k]!=null&&!equal(child[k],records[parent][k]))throw Error('Строка макета относится к другой карточке');tables[name].push({...addr(records[parent]),...child});links[name].push({parent,row});});
 }
 return {tables,links};
}
function normalize(value,definition){if(value==null)return null;if(definition?.type===6)return Math.fround(Number(value));if(typeof value==='boolean')return value?-1:0;return typeof value==='string'?value.toLocaleUpperCase('ru-RU'):value;}
function changes(runtime,initial,records,links){
 const updates=[],deleted=[];
 for(const table of ['Выдел',...Object.keys(links)]){
  const prepared=new Map(runtime.read(table).map(r=>[r.__rid,r])),original=initial[table];
  original.forEach((before,index)=>{
   const ref=table==='Выдел'?{parent:index,row:null}:links[table][index],after=prepared.get(index+1);
   if(!after){deleted.push({table,address:addr(records[ref.parent]),row:ref.row,previous:copy(before)});return;}
   for(const field of Object.keys(before)){
    if(field.startsWith('_')||!own(after,field))continue;
    if(JSON.stringify(normalize(before[field],N.schemas[table]?.[field]))!==JSON.stringify(after[field]))updates.push({table,address:addr(records[ref.parent]),row:ref.row,field,previous:before[field],next:after[field]});
   }
  });
 }
 return {updates,deleted};
}
function incomplete(database,records,reference){
 const out=[];
 records.forEach(r=>{
  const q=database.quarters[String(r.KV)],matches=(q?.quarterRows||[q?.meta||{}]).filter(t=>[['POS','POS'],['LESN','LESN'],['KV','KV'],['KGLF','KGLF'],['Klxr','KlxrVD'],['Fzona','Fzona']].every(([a,b])=>equal(t[a],r[b])));
  const missing=(database.transfSchema?.Выдел||[]).filter(k=>!own(r,k));
  if(matches.length!==1)missing.push('Контекст квартала');
  const owners=(database.lesnichestvo||[]).filter(o=>equal(o.POS,r.POS)&&equal(o.LESN,r.LESN));
  if(owners.length!==1||owners[0].KTO==null)missing.push('Данные лесничества');
  if(!(reference.KuchR||[]).some(o=>equal(o.POSSOLI,r.POS)))missing.push('Связь лесовладельца с территорией');
  if(r.M3Pr!=null&&r.M3Pr!==''&&!(reference.SDP||[]).some(p=>equal(p.KPC,r.M3Pr)))missing.push('Порода из исходного справочника');
  if(missing.length)out.push({address:addr(r),fields:missing,reason:'Недостаточно исходных данных для полной проверки'});
 });return out;
}
async function runLocal(options){
 const database=options.database,records=all(database),indices=options.indices||records.map((_,i)=>i),scoped=indices.map(i=>records[i]),settings=options.settings||E.defaults(),requested=new Set(options.codes||E.groups().flatMap(g=>g.codes));
 const report={format:'SOLIN-Control-Protocol-v2',createdAt:new Date().toISOString(),source:N.source,scope:{records:scoped.length,addresses:scoped.map(addr)},settings,groups:options.routeGroups||E.groups(),nativeButtonParity:false,preparationApplied:false,controls:[],fields:E.fieldRules(scoped,database),findings:[],executions:[],preparation:{copyOnly:true,complete:false,steps:[],updates:[],deleted:[]}};
 let runtime;
 try{
  const reference=options.norms||await norms(),{tables,links}=sourceTables(database,records,settings,reference),owner=database.lesnichestvo?.length===1?database.lesnichestvo[0]:{};
  const context=database.controlContext||database.source?.controlContext||{};
  const parameters={POS:owner.POS,LESN:owner.LESN,TE:context.TE??N.contexts?.find(c=>equal(c.POS,owner.POS)&&equal(c.LESN,owner.LESN))?.TE??null};
  const unverified=incomplete(database,scoped,reference),excluded=new Set(unverified.map(r=>key(r.address))),selected=new Set(scoped.map(key)),byAddress=new Map(records.map(r=>[key(r),r]));
  report.preparation.incompleteInputs=incomplete(database,records,reference);
  function locate(row){
   const available=KEY.filter(k=>row[k]!=null),candidates=records.filter(r=>available.every(k=>equal(r[k],row[k]))),eligible=candidates.filter(r=>selected.has(key(r))&&!excluded.has(key(r)));
   if(!eligible.length&&records.length)return null;
   if(candidates.length===1)return {address:addr(candidates[0]),navigable:true};
   return {address:Object.fromEntries(KEY.map(k=>[k,row[k]??(k==='POS'||k==='LESN'?owner[k]??null:null)])),navigable:false};
  }
  const SQL=options.SQL||await sql();runtime=new window.SolinNativeControlRuntime.Runtime(SQL,N,tables,parameters,{date:options.date||localDate()});
  for(const name of N.preamble)runtime.action(name);
  report.preparation.complete=true;
  const resultByCode=new Map();
  for(const c of N.catalog.filter(c=>requested.has(c.code))){
   const result={code:c.code,title:c.Tosh,status:settings[c.code]?.enabled?'executed':'disabled',matches:0,unverified:[],detail:''};
   if(!c.supported&&result.status==='executed'){result.status='unverified';result.detail='Этот контроль находится вне перенесённого исходного маршрута';}
   if(result.status==='executed'){result.unverified=copy(unverified);if(unverified.length)result.status='partial';}
   resultByCode.set(c.code,result);report.controls.push(result);
  }
  const findings=new Map();
  for(const group of N.groups){
   if(!group.controlSteps.some(step=>requested.has(step.name)))continue;
   let prepared=true,preparationError='';try{for(const name of group.preparation)runtime.action(name);}catch(e){prepared=false;preparationError=e.message||String(e);}
   for(const step of group.controlSteps){
    if(!requested.has(step.name))continue;const result=resultByCode.get(step.name);
    if(!result||result.status==='disabled'||!N.queries[step.name])continue;
    try{
     if(!prepared)throw Error(preparationError);
     const hits=runtime.query(step.name),execution={group:group.macro,code:step.name,status:'executed',rows:0};
     for(const row of hits){const location=locate(row);if(!location)continue;const id=key(location.address);execution.rows++;
      const hitKey=step.name+'|'+id;
      if(findings.has(hitKey)){if(!report.executions.some(e=>e.code===step.name))findings.get(hitKey).occurrences++;continue;}
      const c=N.catalog.find(c=>c.code===step.name),form=(N.queries[step.name].from.sources.find(s=>/^Макет\d+$/.test(s.name))?.name)||'ВыделВ';
      findings.set(hitKey,{kind:'control',code:step.name,...location,form,row:null,status:'error',message:c.Tosh,note:c.Prim,occurrences:1});
     }
     report.executions.push(execution);
    }catch(e){result.status='unverified';result.detail='Для этой проверки недостаточно исходных данных или не удалось завершить расчёт.';result.diagnostic=e.message||String(e);report.executions.push({group:group.macro,code:step.name,status:'unverified',detail:result.diagnostic});}
   }
   if(!options.SQL)await new Promise(r=>setTimeout(r,0));
  }
  // К22 exists in the source, but is absent from all six menus. Keep it an
  // explicitly requested diagnostic, never insert it silently into a group.
  if(requested.has('К22')&&settings.К22?.enabled){try{for(const row of runtime.query('К22')){const record=byAddress.get(key(row));if(record&&selected.has(key(row))&&!excluded.has(key(row)))findings.set('К22|'+key(row),{kind:'control',code:'К22',address:addr(record),form:'ВыделВ',row:null,status:'error',message:N.catalog.find(c=>c.code==='К22').Tosh,occurrences:1});}}catch(e){const c=resultByCode.get('К22');c.status='unverified';c.detail=e.message||String(e);}}
  report.findings=[...findings.values()].filter(f=>!['unverified','disabled'].includes(resultByCode.get(f.code)?.status));
  for(const result of report.controls)result.matches=report.findings.filter(f=>f.code===result.code).reduce((n,f)=>n+f.occurrences,0);
  Object.assign(report.preparation,changes(runtime,tables,records,links));report.preparation.steps=copy(runtime.log);
 }catch(e){report.runtimeError=e.message||String(e);report.preparation.complete=false;for(const c of N.catalog.filter(c=>requested.has(c.code)))if(!report.controls.some(r=>r.code===c.code))report.controls.push({code:c.code,title:c.Tosh,status:settings[c.code]?.enabled?'unverified':'disabled',matches:0,unverified:[],detail:'Не удалось подготовить данные для проверки. Нужны полные исходные карточки и справочники.',diagnostic:report.runtimeError});}
 finally{runtime?.close();}
 report.summary={records:scoped.length,fieldErrors:report.fields.filter(r=>r.status==='error').length,controlFindings:report.findings.reduce((n,f)=>n+f.occurrences,0),executed:report.controls.filter(r=>r.status==='executed').length,partial:report.controls.filter(r=>r.status==='partial').length,unverified:report.controls.filter(r=>r.status==='unverified').length,disabled:report.controls.filter(r=>r.status==='disabled').length,unverifiedFields:report.fields.filter(r=>r.status==='unverified').length};
 return report;
}
async function run(options={}){
 const source=options.database||D,originals=all(source),selected=options.records||originals,before=stamp(source),indices=selected.map(r=>{const i=originals.indexOf(r);if(i<0)throw Error('Карточка отсутствует в выбранной базе');return i;});
 const args={...options,database:copy(source),indices,records:undefined,settings:copy(options.settings||E.defaults()),routeGroups:E.groups()};
 let report;
 if(!options.SQL&&!options.norms&&typeof Worker!=='undefined'){
  report=await new Promise((resolve,reject)=>{const worker=new Worker('./solin-control-worker.js');worker.onmessage=e=>{worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data.report);};worker.onerror=e=>{worker.terminate();reject(Error(e.message||'Не удалось запустить проверку'));};worker.postMessage({options:args,validations:window.SOLIN_AUDIT?.validations||[],routes:window.SOLIN_AUDIT?.routes?.Контроль||[]});});
 }else report=await runLocal(args);
 if(stamp(source)!==before)throw Error('Карточки изменились во время проверки. Повторите запуск.');
 pending.set(report,{source,before,applied:false,allowApply:!options.draft});return report;
}
function applyPreparation(report){
 const state=pending.get(report);if(!state||state.applied||stamp(state.source)!==state.before)throw Error('Данные изменились. Повторите контроль перед применением подготовки.');
 if(!state.allowApply)throw Error('Сначала сохраните черновик карточки');
 if(!report.preparation.complete||report.runtimeError)throw Error('Подготовка не завершена');
 if(report.preparation.incompleteInputs?.length)throw Error('Не хватает исходных данных для безопасного применения подготовки');
 const before=state.source.quarters,working={...state.source,quarters:copy(before)},records=all(working),byKey=new Map(records.map(r=>[key(r),r]));
 try{
  for(const change of report.preparation.updates){const record=byKey.get(key(change.address));if(!record)throw Error('Карточка не найдена');const target=change.table==='Выдел'?record:record._children?.[change.table]?.[change.row];if(!target||JSON.stringify(target[change.field])!==JSON.stringify(change.previous))throw Error('Строка изменилась');target[change.field]=change.next;}
  const deletes=[...report.preparation.deleted].sort((a,b)=>b.row-a.row);
  for(const change of deletes){const record=byKey.get(key(change.address)),target=record?._children?.[change.table];if(!target||!target[change.row])throw Error('Строка изменилась');target.splice(change.row,1);}
  state.source.quarters=working.quarters;
  if(state.source===window.D||typeof D!=='undefined'&&state.source===D)window.solinCore.checkpoint('Подготовка перед контролем');
  state.savedQuarters=before;state.after=stamp(state.source);state.applied=true;report.preparationApplied=true;
 }catch(e){state.source.quarters=before;throw e;}
 return {updated:report.preparation.updates.length,deleted:report.preparation.deleted.length};
}
function undoPreparation(report){const state=pending.get(report);if(!state?.applied||stamp(state.source)!==state.after)throw Error('После подготовки данные изменились; автоматическая отмена недоступна.');const after=state.source.quarters;try{state.source.quarters=state.savedQuarters;if(state.source===window.D||typeof D!=='undefined'&&state.source===D)window.solinCore.checkpoint('Отмена подготовки перед контролем');state.applied=false;report.preparationApplied=false;}catch(e){state.source.quarters=after;throw e;}return true;}
window.SOLIN_CONTROL_DATA.catalog=N.catalog;
E.run=run;E.runLocal=runLocal;E.applyPreparation=applyPreparation;E.undoPreparation=undoPreparation;E.nativeSource=N.source;
})();
