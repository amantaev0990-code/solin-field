/* Isolated execution of the audited Access query graph on SQLite/WASM.
 * All DELETE/UPDATE/append operations below target a disposable in-memory copy.
 * No application storage, original MDB, network upload or DOM access occurs. */
(()=>{'use strict';
const Q=s=>'"'+String(s).replace(/"/g,'""')+'"';
const KEY=['POS','LESN','KV','KGLF','VD'];
const rows=(db,sql)=>db.exec(sql).flatMap(t=>t.values.map(v=>Object.fromEntries(t.columns.map((c,i)=>[c,v[i]]))));
const fold=s=>String(s).toLocaleUpperCase('ru-RU');
class Runtime{
 constructor(SQL,data,tables,parameters,options={}){
  this.data=data;this.db=new SQL.Database();this.schemas={};this.types={};this.functionCount=0;this.cached=new Set();this.base=new Set();this.parameters=parameters;this.options=options;
  this.names=new Map(Object.keys(data.queries).map(n=>[n.toLowerCase(),n]));this.log=[];
  window.SolinAccessExpression.register(this.db,{date:options.date});
  try{
   for(const [name,records]of Object.entries(tables))this.install(name,records);
   for(const name of data.temporaryTables)if(!this.schemas[name])this.install(name,[]);
  }catch(e){this.close();throw e;}
 }
 definition(name){const key=Object.keys(this.data.schemas).find(n=>n.toLowerCase()===name.toLowerCase());return this.data.schemas[key]||{};}
 schema(name){const key=Object.keys(this.schemas).find(n=>n.toLowerCase()===name.toLowerCase());return this.schemas[key];}
 install(name,records,columns){
  const def=this.definition(name);columns=columns||(Object.keys(def).length?Object.keys(def):[...new Set(records.flatMap(r=>Object.keys(r).filter(k=>!k.startsWith('_'))))]);
  if(!columns.length){if(!records.length)return;throw Error('No original schema for '+name);}
  const fields=columns.filter(k=>k!=='__rid');
  this.db.run('CREATE TABLE '+Q(name)+' (__rid INTEGER PRIMARY KEY,'+fields.map(k=>Q(k)+(def[k]?.type>=10?' TEXT COLLATE RTRIM':def[k]?.type&&def[k].type<=7?' NUMERIC':records.some(r=>typeof r[k]==='number')?' NUMERIC':' TEXT COLLATE RTRIM')).join(',')+')');
  const statement=this.db.prepare('INSERT INTO '+Q(name)+' ('+fields.map(Q).join(',')+') VALUES ('+fields.map(()=>'?').join(',')+')');
  try{for(const record of records){statement.run(fields.map(k=>{
   const value=record[k];if(value==null)return null;const type=def[k]?.type;
   if(type&&type<=7){const n=window.SolinAccessExpression.number(value);if(type===1)return n===0?0:-1;if(type===6){const single=Math.fround(n);if(!Number.isFinite(single))throw Error('Число вне допустимого диапазона '+name+'.'+k);return single;}if([2,3,4].includes(type)){const bounds={2:[0,255],3:[-32768,32767],4:[-2147483648,2147483647]}[type];if(!Number.isInteger(n)||n<bounds[0]||n>bounds[1])throw Error('Недопустимое целое число '+name+'.'+k);}return n;}
   if(typeof value==='boolean')return value?-1:0;if(typeof value==='object')throw Error('Unsupported field value '+name+'.'+k);
   return typeof value==='string'?fold(value):value;
  }));}}finally{statement.free();}
  this.schemas[name]=[...fields,'__rid'];this.base.add(name);
  this.types[name]=Object.fromEntries(fields.map(k=>[k,def[k]?.type]));
  this.index(name);
 }
 index(name){const fields=this.schemas[name];if(fields.includes('POS')&&fields.includes('LESN'))this.db.run('CREATE INDEX '+Q('__addr_'+name)+' ON '+Q(name)+' ('+KEY.filter(k=>fields.includes(k)).map(Q).join(',')+')');}
 clear(){for(const name of this.cached){this.db.run('DROP TABLE IF EXISTS '+Q(name));delete this.schemas[name];}this.cached.clear();}
 ensure(name,stack=[]){
  if(this.schema(name)){this.schemas[name]=this.schema(name);return;}
  const canonical=this.names.get(name.toLowerCase());if(!canonical)throw Error('Отсутствует исходная таблица '+name);
  if(canonical!==name){this.ensure(canonical,stack);this.schemas[name]=this.schemas[canonical];return;}
  if(stack.includes(name))throw Error('Cyclic source '+[...stack,name].join(' → '));
  const plan=this.data.queries[name];if(plan.kind!=='select'||plan.into)throw Error('Подготовительная таблица ещё не создана: '+name);
  for(const source of plan.from.sources)this.ensure(source.name,[...stack,name]);
  if(name==='Mak10_3_78'||name==='К114_а')return this.multiNum(name,plan);
  if(name==='К100_1')return this.duplicateComposition(name,plan);
  try{this.materialize(name,plan);}catch(e){throw Error(name+': '+(e.message||String(e)));}
 }
 compile(plan){return window.SolinAccessSQL.compiler(plan,this.schemas,this.parameters,{types:this.types,date:this.options.date,scalar:(ast,resolve)=>{
  const refs=new Map();let aggregate=false;
  function walk(n){if(n.kind==='ref')refs.set(JSON.stringify(n.path),n.path);if(n.kind==='call'){if(['sum','max','min','count','first'].includes(n.name))aggregate=true;n.args.forEach(walk);}if(n.left)walk(n.left);if(n.right)walk(n.right);if(n.arg)walk(n.arg);}
  walk(ast);if(aggregate)return window.SolinAccessExpression.sql(ast,resolve);
  const fields=[...refs.values()];if(fields.length>100)throw Error('Scalar expression has too many source fields');
  const index=new Map(fields.map((f,i)=>[JSON.stringify(f),i]));
  const fn=(...args)=>{try{return window.SolinAccessExpression.evaluate(ast,p=>args[index.get(JSON.stringify(p))],true);}catch(e){throw String(e.message||e);}};Object.defineProperty(fn,'length',{value:fields.length});
  const name='__ac_expr_'+(++this.functionCount);this.db.create_function(name,fn);return name+'('+fields.map(resolve).join(',')+')';
 }});}
 materialize(name,plan){
  const compiled=this.compile(plan);this.db.run('CREATE TABLE '+Q(name)+' AS '+compiled.sql);
  this.schemas[name]=rows(this.db,'PRAGMA table_info('+Q(name)+')').map(r=>r.name);this.types[name]=compiled.types;this.cached.add(name);this.index(name);return compiled;
 }
 multiNum(name,plan){
  const clean=JSON.parse(JSON.stringify(plan));clean.columns=clean.columns.filter(c=>!/^MultiNum\(/i.test(c.expression));
  if(!clean.columns.some(c=>c.alias==='KP'))clean.columns.push({expression:'[KP]',alias:'__multiKey'});
  clean.where=clean.where.replace(/\(\(MultiNum\(3\)\)\s*=\s*0\)/ig,'(1=1)');
  const result=rows(this.db,this.compile(clean).sql),num=[0,0,0,0],old=[null,null,null,null];
  // The source WHERE initializes the static arrays once. Evaluate its three
  // numbered expressions in the source sort order; do not use a stale table.
  for(const r of result){for(const [level,key]of [[1,'KV'],[2,'VD'],[3,'KP']]){
   const v=key==='KP'?(r.KP??r.__multiKey):r[key];if(v!=null&&(old[level]===null||window.SolinAccessExpression.compare('=',old[level],v)!==-1)){
    old[level]=v;num[level]++;for(let i=level+1;i<=3;i++){num[i]=0;old[i]=null;}
   }r['Lev_'+level]=num[level];
  }}
  this.install(name,result,plan.columns.map(c=>c.alias));this.base.delete(name);this.cached.add(name);
 }
 duplicateComposition(name,plan){
  // The only correlated IN subquery in the audited graph. Its HAVING fixes
  // VD/IAR/POR/LET to the outer row; the duplicate key also includes KV.
  const keys=['KV','VD','IAR','POR','LET'];
  const source='Макет10Выб',alias='__duplicate';
  const sql='SELECT m.* FROM '+Q(source)+' m INNER JOIN (SELECT '+keys.map(Q).join(',')+' FROM '+Q(source)+' GROUP BY '+keys.map(Q).join(',')+' HAVING COUNT(*)>1) '+Q(alias)+' ON '+keys.map(k=>'m.'+Q(k)+' = '+Q(alias)+'.'+Q(k)).join(' AND ');
  this.db.run('CREATE TABLE '+Q(name)+' AS '+sql);this.schemas[name]=this.schemas[source];this.cached.add(name);
 }
 action(name){
  this.clear();const plan=this.data.queries[name];if(!plan)throw Error('Missing action '+name);
  const select=plan.select||plan;
  for(const source of select.from.sources)this.ensure(source.name);
  let changed=0;
  if(plan.kind==='select'&&plan.into){
   const compiled=this.compile(plan);this.db.run('DROP TABLE IF EXISTS '+Q(plan.into));
   this.db.run('CREATE TABLE '+Q(plan.into)+' AS '+compiled.sql);
   this.db.run('ALTER TABLE '+Q(plan.into)+' ADD COLUMN __rid INTEGER');this.db.run('UPDATE '+Q(plan.into)+' SET __rid=rowid');
   this.schemas[plan.into]=rows(this.db,'PRAGMA table_info('+Q(plan.into)+')').map(r=>r.name);this.types[plan.into]=compiled.types;this.base.add(plan.into);this.index(plan.into);
   changed=rows(this.db,'SELECT Count(*) AS n FROM '+Q(plan.into))[0].n;
  }else if(plan.kind==='insert'){
   if(!this.schema(plan.target))throw Error('Missing append target');
   const compiled=this.compile(plan.select);this.db.run('INSERT INTO '+Q(plan.target)+' ('+plan.fields.map(Q).join(',')+') '+compiled.sql);changed=this.db.getRowsModified();
   this.db.run('UPDATE '+Q(plan.target)+' SET __rid=rowid WHERE __rid IS NULL');
  }else if(plan.kind==='delete'){
   const compiled=this.compile(plan),ids=rows(this.db,compiled.sql).map(r=>r.__target);
   const statement=this.db.prepare('DELETE FROM '+Q(plan.target)+' WHERE __rid=?');
   try{for(const id of new Set(ids)){statement.run([id]);changed+=this.db.getRowsModified();}}finally{statement.free();}
  }else if(plan.kind==='update'){
   const compiled=this.compile(plan),updates=rows(this.db,compiled.sql),target=plan.target==='ВыделЛес'?'Выдел':plan.target;
   if(!this.base.has(target))throw Error('Update target is not an isolated source table');
   const statement=this.db.prepare('UPDATE '+Q(target)+' SET '+plan.assignments.map(a=>Q(a.field)+'=?').join(',')+' WHERE '+KEY.map(k=>Q(k)+'=?').join(' AND '));
   try{for(const r of updates){statement.run([...plan.assignments.map(a=>r[a.field]),...KEY.map(k=>r[k])]);changed+=this.db.getRowsModified();}}finally{statement.free();}
  }else throw Error('Unsupported preparation '+name);
  this.log.push({name,records:changed,status:'executed'});this.clear();return changed;
 }
 query(name){this.ensure(name);return rows(this.db,'SELECT * FROM '+Q(name));}
 read(name){return rows(this.db,'SELECT * FROM '+Q(name));}
 close(){this.db?.close();this.db=null;}
}
window.SolinNativeControlRuntime={Runtime,rows};
})();
