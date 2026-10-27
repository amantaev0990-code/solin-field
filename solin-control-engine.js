/* Runs saved direct predicates against an isolated, current mobile snapshot.
 * Never executes source action queries, trusts stale staging tables, or writes D.
 * SQL/Access button parity remains false until native differential verification.
 */
(()=>{'use strict';
const A=window.SolinAccessExpression,Q=A.quote,KEYS=['POS','LESN','KV','KGLF','VD'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k),clone=v=>JSON.parse(JSON.stringify(v));
const eq=(a,b)=>a!=null&&b!=null&&String(a)===String(b);
const all=database=>Object.values(database.quarters||{}).flatMap(q=>q.compartments||[]);
const address=r=>Object.fromEntries(KEYS.map(k=>[k,r[k]??null]));
function groups(){return (window.SOLIN_AUDIT?.routes?.Контроль||[]).filter(b=>(b.actions||[]).some(x=>x.action==='OpenForm'&&/^К\d+$/.test(x.args[0]))).map((b,i)=>({id:String(i+1),name:b.caption.trim().replace(/\s+/g,' '),codes:[...new Set(b.actions.filter(x=>x.action==='OpenForm'&&/^К\d+$/.test(x.args[0])).map(x=>x.args[0]))],openings:b.actions.filter(x=>x.action==='OpenForm'&&/^К\d+$/.test(x.args[0])).length}));}
function defaults(){return Object.fromEntries(window.SOLIN_CONTROL_DATA.catalog.map(c=>[c.code,{enabled:c.Priz===true,Usl1:c.Usl1,Usl2:c.Usl2}]));}
let sqlPromise;
function loadSQL(){if(!sqlPromise)sqlPromise=initSqlJs({locateFile:p=>'./vendor/'+p}).catch(e=>{sqlPromise=null;throw e;});return sqlPromise;}
function enrich(r,database,index){const result={...r,__record:index};delete result._children;
 try{result.VDCH=A.val(r.VD);}catch(_){}
 const rows=database.quarters[String(r.KV)]?.quarterRows||[database.quarters[String(r.KV)]?.meta||{}];
 const matches=rows.filter(q=>eq(q.POS,r.POS)&&eq(q.LESN,r.LESN)&&eq(q.KV,r.KV)&&eq(q.KGLF,r.KGLF)&&eq(q.Klxr,r.KlxrVD)&&eq(q.Fzona,r.Fzona));
 if(matches.length===1){const q=matches[0];for(const k of ['Kpz','Klxr','Raion','Dost','Udal','Rel','Kmu','Kob'])if(own(q,k))result[k]=q[k];if(own(q,'GodT'))result.GodT1=q.GodT;}
 const owners=(database.lesnichestvo||[]).filter(o=>eq(o.POS,r.POS)&&eq(o.LESN,r.LESN));
 if(owners.length===1){for(const k of ['KTO','GodPU'])if(own(owners[0],k))result[k]=owners[0][k];if(result.KTO!=null)result.Obl=A.round(A.number(result.KTO)/10000000,0);}
 return result;
}
function tablesFor(database,records,refs,settings){const data=window.SOLIN_CONTROL_DATA,raw={};
 raw.ВыделВыб=records.map((r,i)=>enrich(r,database,i));
 raw.KUch=(database.lesnichestvo||[]).map(o=>({...o,B:-1}));
 raw.Контроли=data.catalog.map(c=>({...c,Priz:settings[c.code]?.enabled?-1:0,Usl1:settings[c.code]?.Usl1??null,Usl2:settings[c.code]?.Usl2??null}));
 for(const [form,schema]of Object.entries(database.transfSchema||{}))if(/^Макет\d+$/.test(form))raw[form]=[];
 records.forEach((r,parent)=>{for(const [form,rows]of Object.entries(r._children||{}))if(/^Макет\d+$/.test(form)){
 (raw[form]??=[]).push(...rows.map((row,index)=>({...Object.fromEntries(KEYS.filter(k=>!own(row,k)).map(k=>[k,r[k]??null])),...row,__row:index,__parent:parent})));
 }});
 for(const plan of Object.values(data.queries))for(const name of plan.sources)if(name.startsWith('S')&&own(refs||{},name))raw[name]=refs[name];
 const schemas={};for(const [name,rows]of Object.entries(raw)){
 schemas[name]=[...new Set([...(database.transfSchema?.[name]||[]),...rows.flatMap(r=>Object.keys(r).filter(k=>!k.startsWith('_')||k.startsWith('__')))])];
 if(name==='ВыделВыб')schemas[name]=[...new Set([...schemas[name],...(database.transfSchema?.Выдел||[]),'VDCH','Kpz','Klxr','GodT1','KTO','GodPU','Obl','Raion','Dost','Udal','Rel','Kmu','Kob','__record'])];
 if(/^Макет\d+$/.test(name))schemas[name]=[...new Set([...schemas[name],...KEYS,'__row','__parent'])];
 if(name.startsWith('S'))schemas[name]=[...new Set([...schemas[name],...(database.referenceSchema?.[name]||[])])];
 }
 return {raw,schemas};
}
function install(db,raw,schemas){for(const [name,rows]of Object.entries(raw)){
 const columns=schemas[name];if(!columns.length)continue;db.run('CREATE TABLE '+Q(name)+' ('+columns.map(k=>Q(k)+(k==='VD'?' TEXT':rows.some(r=>typeof r[k]==='number'||typeof r[k]==='boolean')?' NUMERIC':' TEXT')).join(',')+')');
 const insert=db.prepare('INSERT INTO '+Q(name)+' VALUES ('+columns.map(()=>'?').join(',')+')');
 // Fold text in the isolated SQL copy so indexed joins also match Cyrillic
 // codes without case sensitivity. Keep spaces and the original input intact.
 try{for(const row of rows)insert.run(columns.map(k=>row[k]===undefined||row[k]===null?null:typeof row[k]==='boolean'?(row[k]?-1:0):typeof row[k]==='string'?row[k].toLocaleUpperCase('ru-RU'):typeof row[k]==='object'?JSON.stringify(row[k]):row[k]));}finally{insert.free();}
 if(columns.includes('POS')&&columns.includes('LESN')){const key=KEYS.filter(k=>columns.includes(k));db.run('CREATE INDEX '+Q('__address_'+name)+' ON '+Q(name)+' ('+key.map(Q).join(',')+')');}
 }}
function compile(name,schemas,parameters,track=new Map(),stack=[]){const plan=window.SOLIN_CONTROL_DATA.queries[name];if(!plan)throw Error('Нет перенесённого запроса '+name);
 const aliases=Object.fromEntries(plan.columns.filter(c=>c.alias).map(c=>[c.alias.toLowerCase(),c.expression]));
 function resolve(path,expanding=[]){
 if(path.length===3&&path[0].toLowerCase()==='forms'&&path[1]==='ГОЛОВНОЕ МЕНЮ'){
 const k={'ЛВ_1':'POS','Лес_1':'LESN'}[path[2]];if(!k||parameters[k]==null)throw Error('Нет однозначного выбора лесничества');return A.sql({kind:'literal',value:parameters[k]},()=>{});
 }
 let table,field;
 if(path.length===2){table=plan.sources.find(s=>s.toLowerCase()===path[0].toLowerCase());field=schemas[table]?.find(k=>k.toLowerCase()===path[1].toLowerCase());}
 else if(path.length===1){const key=path[0].toLowerCase(),candidates=plan.sources.flatMap(s=>(schemas[s]||[]).filter(k=>k.toLowerCase()===key).map(k=>[s,k]));
 if(candidates.length===1)[table,field]=candidates[0];
 else if(aliases[key]){if(expanding.includes(key))throw Error('Цикл вычисляемого поля '+path[0]);return A.sql(A.parse(aliases[key]),p=>resolve(p,[...expanding,key]));}
 else throw Error((candidates.length?'Неоднозначное поле ':'Нет поля ')+path[0]);
 }
 if(!table||!field)throw Error('Нет поля '+path.join('.'));
 (track.get(table)||track.set(table,new Set()).get(table)).add(field);return Q(table)+'.'+Q(field);
 }
 const expr=s=>A.sql(A.parse(s),p=>resolve(p));
 // Source joins are column equalities. Keep them indexable; SQLite's column
 // affinities reconcile numeric code strings, VD is always a text address.
 const joinExpr=s=>{const ast=A.parse(s);if(ast.kind!=='binary'||ast.op!=='='||ast.left.kind!=='ref'||ast.right.kind!=='ref')throw Error('Сложное условие соединения требует сверки');return resolve(ast.left.path)+' COLLATE NOCASE = '+resolve(ast.right.path);};
 for(const source of plan.sources)if(!schemas[source]?.length)throw Error('Нет таблицы '+source);
 const edges=[];for(const j of plan.joins){if(![1,2].includes(j.kind))throw Error('Тип соединения требует сверки');let edge=edges.find(e=>e.left===j.left&&e.right===j.right&&e.kind===j.kind);if(!edge){edge={left:j.left,right:j.right,kind:j.kind,parts:[]};edges.push(edge);}edge.parts.push(j.expression);}
 const remaining=new Set(plan.sources),added=new Set();
 const start=plan.sources.includes('ВыделВыб')?'ВыделВыб':plan.sources.find(n=>!edges.some(e=>e.kind===2&&e.right===n));
 if(!start)throw Error('Не определён порядок соединений');remaining.delete(start);added.add(start);let from=Q(start);const used=new Set();
 while(remaining.size){let chosen=null,joins=[];
 for(const next of remaining){const incoming=edges.filter(e=>e.kind===2&&e.right===next);if(incoming.some(e=>!added.has(e.left)))continue;
 const connected=edges.filter(e=>(e.right===next&&added.has(e.left))||(e.kind===1&&e.left===next&&added.has(e.right)));
 if(connected.length||!edges.some(e=>(e.left===next&&remaining.has(e.right))||(e.right===next&&remaining.has(e.left)))){chosen=next;joins=connected;break;}}
 if(!chosen)throw Error('Сложный порядок соединений требует сверки');
 const kinds=new Set(joins.map(e=>e.kind));if(kinds.size>1)throw Error('Смешанное внешнее соединение требует сверки');
 if(joins.length){from+=(kinds.has(2)?' LEFT JOIN ':' INNER JOIN ')+Q(chosen)+' ON '+joins.flatMap(e=>e.parts.map(p=>'('+joinExpr(p)+')')).join(' AND ');joins.forEach(e=>used.add(e));}
 else from+=' CROSS JOIN '+Q(chosen);
 remaining.delete(chosen);added.add(chosen);
 }
 const unused=edges.filter(e=>!used.has(e));if(unused.some(e=>e.kind===2))throw Error('Внешний цикл соединений требует сверки');
 const where=[...(plan.where?[expr(plan.where)]:[]),...unused.flatMap(e=>e.parts.map(joinExpr))];
 const isRoot=/^К\d+$/.test(name);let select;
 if(isRoot){select=Q('ВыделВыб')+'.'+Q('__record')+' AS __record';for(const s of plan.sources.filter(s=>/^Макет\d+$/.test(s)))select+=','+Q(s)+'.'+Q('__row')+' AS '+Q(s+'__row')+','+Q(s)+'.'+Q('__parent')+' AS '+Q(s+'__parent');}
 else select=plan.columns.map(c=>expr(c.expression)+(c.alias?' AS '+Q(c.alias):'')).join(',');
 // Every permitted helper has only grouped, nonaggregate HAVING expressions.
 // Pushing that filter before GROUP BY avoids building a card × catalogue
 // product while preserving this deliberately restricted query subset.
 if(plan.having)where.push(expr(plan.having));
 let sql='SELECT '+select+' FROM '+from+(where.length?' WHERE '+where.map(w=>'('+w+')').join(' AND '):'');
 if(plan.group.length)sql+=' GROUP BY '+plan.group.map(expr).join(',');
 return {sql,track};
}
function fieldRules(records,database){const out=[];for(const r of records)for(const v of window.SOLIN_AUDIT?.validations||[]){
 const rows=v.form==='ВыделВ'?[r]:database.transfSchema?.[v.form]?r._children?.[v.form]||[]:[];
 rows.forEach((row,index)=>{let status,detail='';try{if(!own(row,v.source))throw Error('Нет поля '+v.source);const ok=A.rule(v.rule,row[v.source],{...r,...row},r);status=ok===false?'error':ok===null?'null':'ok';}catch(e){status='unverified';detail=e.message;}
 out.push({kind:'field',code:'Правило поля',address:address(r),form:v.form,field:v.source,row:index,status,message:status==='error'?'Значение не соответствует правилу поля':detail,rule:v.rule});});
 }return out;}
async function run(options={}){const source=options.database||D,originals=all(source),selected=options.records||originals;
 const indices=selected.map(r=>{const index=originals.indexOf(r);if(index<0)throw Error('Карточка отсутствует в выбранной базе');return index;});
 const database=clone(source),records=all(database),scoped=indices.map(i=>records[i]),settings=clone(options.settings||defaults()),data=window.SOLIN_CONTROL_DATA;
 const report={format:'SOLIN-Control-Protocol-v1',createdAt:new Date().toISOString(),source:data.source,scope:{records:scoped.length,addresses:scoped.map(address)},settings,groups:groups(),nativeButtonParity:false,preparationApplied:false,controls:[],fields:fieldRules(scoped,database),findings:[]};
 const requested=new Set(options.codes||groups().flatMap(g=>g.codes));const active=data.catalog.filter(c=>requested.has(c.code)&&settings[c.code]?.enabled);
 const {raw,schemas}=tablesFor(database,records,options.refs||window.SOLIN_REFS?.tables,settings);
 const parameters=database.lesnichestvo?.length===1?database.lesnichestvo[0]:{};let db;
 try{if(active.some(c=>c.supported)){const SQL=options.SQL||await loadSQL();db=new SQL.Database();A.register(db);install(db,raw,schemas);}
 for(const c of data.catalog.filter(c=>requested.has(c.code))){
 const result={code:c.code,title:c.Tosh,status:!settings[c.code]?.enabled?'disabled':!c.supported?'unverified':'executed',matches:0,unverified:[],detail:!c.supported?'Этот контроль ещё не перенесён. Требуется исходная подготовка данных или зависимые запросы.':''};
 report.controls.push(result);if(result.status!=='executed')continue;
 try{const root=data.queries[c.code],track=new Map();for(const gate of root.sources.filter(n=>data.queries[n])){
 const compiled=compile(gate,schemas,parameters,track);db.run('DROP VIEW IF EXISTS '+Q(gate));db.run('CREATE TEMP VIEW '+Q(gate)+' AS '+compiled.sql);
 schemas[gate]=data.queries[gate].columns.map(col=>col.alias||col.expression.split(/[.!]/).at(-1).replace(/[\[\]]/g,''));
 }
 const compiled=compile(c.code,schemas,parameters,track),required=track.get('ВыделВыб')||new Set();
 for(const index of indices){const missing=[...required].filter(k=>!own(raw.ВыделВыб[index],k));if(missing.length)result.unverified.push({address:address(records[index]),fields:missing,reason:'Нет однозначного контекста или исходных полей'});}
 const excluded=new Set(result.unverified.map(x=>JSON.stringify(x.address))),hits=db.exec(compiled.sql);
 const found=new Map();for(const tab of hits)for(const values of tab.values){const row=Object.fromEntries(tab.columns.map((k,i)=>[k,values[i]])),index=row.__record;
 if(!indices.includes(index)||excluded.has(JSON.stringify(address(records[index]))))continue;
 const prior=found.get(index);if(prior){prior.occurrences++;continue;}
 const children=root.sources.filter(s=>/^Макет\d+$/.test(s)),form=children.find(s=>row[s+'__parent']===index)||'ВыделВ';
 const item={kind:'control',code:c.code,address:address(records[index]),form,row:form==='ВыделВ'?null:row[form+'__row'],status:'error',message:c.Tosh,note:c.Prim,occurrences:1};found.set(index,item);
 }
 result.matches=found.size;report.findings.push(...found.values());if(result.unverified.length)result.status='partial';
 }catch(e){result.status='unverified';result.detail=e.message||'Ошибка типа данных или вычисления условия';}
 }
 }catch(e){for(const c of active)if(!report.controls.some(x=>x.code===c.code))report.controls.push({code:c.code,title:c.Tosh,status:'unverified',matches:0,unverified:[],detail:'Не удалось выполнить контроль: '+e.message});report.runtimeError=e.message;
 }finally{db?.close();}
 report.summary={records:scoped.length,fieldErrors:report.fields.filter(x=>x.status==='error').length,controlFindings:report.findings.length,executed:report.controls.filter(x=>x.status==='executed').length,partial:report.controls.filter(x=>x.status==='partial').length,unverified:report.controls.filter(x=>x.status==='unverified').length,disabled:report.controls.filter(x=>x.status==='disabled').length,unverifiedFields:report.fields.filter(x=>x.status==='unverified').length};
 return report;
}
window.SolinControlEngine={run,groups,defaults,compile,fieldRules};
})();
