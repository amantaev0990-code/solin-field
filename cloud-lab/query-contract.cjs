'use strict';
// Compare saved Jet attributes with a Field plan. This checks definitions,
// not native Access execution, join-tree precedence or live event binding.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../solin-access-sql.js'),'utf8'),sandbox);
const SQL=sandbox.window.SolinAccessSQL;
const fold=s=>String(s??'').toLocaleUpperCase('ru-RU');
function orderKey(a){const v=a.Order?.data??a.Order??[];return Array.from(v);}
function ordered(attributes,kind){return attributes.filter(a=>a.Attribute===kind).map((value,index)=>({value,index})).sort((a,b)=>{
 const x=orderKey(a.value),y=orderKey(b.value);for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]??-1)-(y[i]??-1);if(d)return d;}return a.index-b.index;
}).map(x=>x.value);}
function expression(s){if(s==null)return null;return JSON.stringify(SQL.tokens(String(s)).map(t=>[t.kind,t.kind==='name'?fold(t.value):t.value]));}
const identifier=s=>SQL.tokens(String(s??'')).filter(t=>t.kind==='name').map(t=>fold(t.value));
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function joinTree(ast){
 if(!ast)return null;
 if(ast.kind==='table')return {kind:'table',name:fold(ast.name),alias:fold(ast.alias||ast.name)};
 if(ast.kind==='join')return {kind:'join',join:fold(ast.join),left:joinTree(ast.left),right:joinTree(ast.right),on:expression(ast.on)};
 throw Error('Unsupported saved join node');
}
function compareRegeneratedSql(sql,plan){
 try{
  const regenerated=SQL.parse(sql),original=regenerated.select||regenerated,actual=plan.select||plan;
  const checks={kind:regenerated.kind===plan.kind,joinTree:eq(joinTree(original.from?.ast),joinTree(actual.from?.ast))};
  return {status:Object.values(checks).every(Boolean)?'matched':'different',checks,nativeRuntimeVerified:false,
   scope:'Join direction, precedence, source identities and ON tokens from independently regenerated saved SQL. Native execution remains separate.'};
 }catch(e){return {status:'unverified',reason:e.message,nativeRuntimeVerified:false};}
}
function projection(rows){return rows.map((a,i)=>{
 const ts=SQL.tokens(a.Expression||''),last=ts.at(-1);return {expression:expression(a.Expression),alias:a.Name1?fold(a.Name1):last?.value==='*'?null:last?.kind==='name'?fold(last.value):'EXPR'+(1000+i)};
});}
function compare(query,plan){
 if(!plan)return {status:'unverified',reason:'No implementation plan',nativeRuntimeVerified:false};
 const a=query.attributes||[],type=ordered(a,1)[0],select=plan.select||plan;
 // Jackcess QueryImpl.create / QueryFormat: query kind is primarily
 // MSysObjects.Flags & 0xF0. Plain SELECT often has no TYPE_ATTRIBUTE row.
 const objectTypes={0:1,80:2,64:3,48:4,32:5};
 const objectType=Number.isInteger(query.objectFlags)?objectTypes[query.objectFlags&0xf0]:undefined;
 const queryType=objectType===1&&type?.Flag?type.Flag:objectType??type?.Flag;
 if(objectType&&objectType!==1&&type?.Flag&&objectType!==type.Flag)
  return {status:'unverified',reason:'Conflicting object and row query type',nativeRuntimeVerified:false};
 const kind=({1:'select',2:'select',3:'insert',4:'update',5:'delete'})[queryType];
 if(!kind)return {status:'unverified',reason:'Unsupported original query type',nativeRuntimeVerified:false};
 const checks={kind:kind===plan.kind};const columns=ordered(a,6);
 checks.where=expression(ordered(a,8)[0]?.Expression)===expression(select.where);
 if(kind==='select'||kind==='insert'){
  const original=projection(columns),actual=(select.columns||[]).map(c=>({expression:expression(c.expression),alias:c.expression.trim().endsWith('*')?null:fold(c.alias)}));
  checks.columns=eq(original,actual);
  checks.having=expression(ordered(a,10)[0]?.Expression)===expression(select.having);
  checks.group=eq(ordered(a,9).map(a=>expression(a.Expression)),(select.group||[]).map(expression));
  checks.order=eq(ordered(a,11).map(a=>({expression:expression(a.Expression),descending:fold(a.Name1)==='D'})),(select.order||[]).map(a=>({expression:expression(a.expression),descending:!!a.descending})));
  const flags=ordered(a,3)[0]?.Flag||0;checks.distinct=Boolean(flags&(2|8))===!!select.distinct;
  if(kind==='insert'){
   checks.target=fold(type.Name1)===fold(plan.target);
   checks.appendFields=eq(columns.map(a=>identifier(a.Name2).at(-1)),(plan.fields||[]).map(fold));
  }else checks.into=fold(queryType===2?type?.Name1:null)===fold(plan.into);
 }else if(kind==='update'){
  checks.assignments=eq(columns.map(a=>({target:identifier(a.Name2),expression:expression(a.Expression)})),(plan.assignments||[]).map(a=>({target:[fold(a.table),fold(a.field)],expression:expression(a.expression)})));
  const targets=new Set(columns.map(a=>identifier(a.Name2)[0]));checks.target=targets.size===1&&targets.has(fold(plan.target));
 }else{
  // Access serializes every displayed delete column; the executable plan
  // stores the deletion target, not a SELECT projection of these columns.
  const targets=new Set(columns.map(a=>identifier(a.Expression)[0]));checks.target=targets.size===1&&targets.has(fold(plan.target));
 }
 const sourceTables=ordered(a,5).map(a=>({name:fold(a.Name1),alias:fold(a.Name2||a.Name1)})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const planTables=(select.from?.sources||[]).map(a=>({name:fold(a.name),alias:fold(a.alias||a.name)})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 checks.sourceTables=eq(sourceTables,planTables);
 const differences=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
 return {status:differences.length?'different':'matched',checks,differences,nativeRuntimeVerified:false,
  scope:'Ordered projections/aliases; action type/target/assignments; WHERE/HAVING/GROUP/ORDER; source tables. Join-tree runtime equivalence is separate.'};
}
module.exports={compare,ordered,expression,compareRegeneratedSql};
