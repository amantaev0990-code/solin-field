/* Parser for the audited saved-query SQL subset. It never executes source text
 * directly: expressions and source identifiers pass through the compiler. */
(()=>{'use strict';
const Q=s=>'"'+String(s).replace(/"/g,'""')+'"';
function tokens(text){
 const out=[];let i=0;
 while(i<text.length){
  if(/\s/.test(text[i])){i++;continue;}
  const start=i,c=text[i];
  if(c==='"'||c==="'"){i++;while(i<text.length){if(text[i]===c){if(text[i+1]===c){i+=2;continue;}i++;break;}i++;}out.push({value:text.slice(start,i),kind:'string',start,end:i});continue;}
  if(c==='['){const end=text.indexOf(']',i+1);if(end<0)throw Error('Unclosed identifier');i=end+1;out.push({value:text.slice(start+1,end),kind:'name',start,end:i});continue;}
  const m=text.slice(i).match(/^[\p{L}_][\p{L}\p{N}_]*/u);
  if(m){i+=m[0].length;out.push({value:m[0],kind:'name',start,end:i});continue;}
  i++;out.push({value:c,kind:'op',start,end:i});
 }
 return out;
}
function split(text,separator=','){
 const t=tokens(text),result=[];let depth=0,start=0;
 for(const token of t){if(token.value==='(')depth++;else if(token.value===')')depth--;else if(depth===0&&token.kind==='op'&&token.value===separator){result.push(text.slice(start,token.start).trim());start=token.end;}}
 result.push(text.slice(start).trim());return result;
}
function clauses(text,names){
 const ts=tokens(text),matches=[];let depth=0;
 for(let i=0;i<ts.length;i++){
  const t=ts[i];if(t.value==='('){depth++;continue;}if(t.value===')'){depth--;continue;}
  if(depth||t.kind!=='name')continue;
  for(const name of names){const words=name.split(' ');if(words.every((w,j)=>ts[i+j]?.kind==='name'&&ts[i+j].value.toUpperCase()===w)){matches.push({name,start:t.start,end:ts[i+words.length-1].end});i+=words.length-1;break;}}
 }
 return matches;
}
function from(text){
 const ts=tokens(text),sources=[];let i=0;
 const is=v=>ts[i]?.kind!=='string'&&ts[i]?.value.toUpperCase()===v;
 function atom(){
  if(is('(')){i++;const n=tree();if(!is(')'))throw Error('Invalid source parentheses');i++;return n;}
  const t=ts[i++];if(t?.kind!=='name')throw Error('Invalid query source');
  let alias=t.value;if(is('AS')){i++;alias=ts[i++]?.value;if(!alias)throw Error('Missing source alias');}
  const s={name:t.value,alias};sources.push(s);return {kind:'table',...s};
 }
 function tree(){
  let left=atom();
  while(i<ts.length&&!is(')')){
   if(is(',')){i++;left={kind:'join',join:'CROSS',left,right:atom(),on:null};continue;}
   let join='INNER';if(['INNER','LEFT','RIGHT','CROSS'].some(is)){join=ts[i++].value.toUpperCase();if(is('OUTER'))i++;}
   if(!is('JOIN'))throw Error('Unexpected source token '+ts[i]?.value);i++;
   const right=atom();let on=null;
   if(join!=='CROSS'){
    if(!is('ON'))throw Error('Missing join condition');i++;
    const first=i;let depth=0;
    while(i<ts.length){const t=ts[i];if(t.value==='(')depth++;else if(t.value===')'){if(!depth)break;depth--;}
     if(!depth&&t.kind!=='string'&&['INNER','LEFT','RIGHT','JOIN','CROSS',','].includes(t.value.toUpperCase()))break;i++;
    }
    if(i===first)throw Error('Empty join condition');on=text.slice(ts[first].start,ts[i-1].end);
   }
   left={kind:'join',join,left,right,on};
  }
  return left;
 }
 const ast=tree();if(i!==ts.length)throw Error('Unparsed source');return {ast,sources};
}
function identifier(s){const t=tokens(s.trim());if(t.length!==1||t[0].kind!=='name')throw Error('Invalid identifier '+s);return t[0].value;}
function column(text,index){
 const as=clauses(text,['AS']);if(as.length>1)throw Error('Invalid column alias');
 if(as.length)return {expression:text.slice(0,as[0].start).trim(),alias:identifier(text.slice(as[0].end))};
 const t=tokens(text),last=t.at(-1);return {expression:text,alias:last?.kind==='name'?last.value:'Expr'+(1000+index)};
}
function parse(text){
 text=text.trim().replace(/;\s*$/,'');
 const head=tokens(text)[0]?.value.toUpperCase();
 if(head==='INSERT'){
  const c=clauses(text,['INTO','SELECT']);if(c.length!==2)throw Error('Unsupported append query');
  const target=text.slice(c[0].end,c[1].start).trim(),open=target.indexOf('(');
  if(open<0||!target.endsWith(')'))throw Error('Append field list required');
  return {kind:'insert',target:identifier(target.slice(0,open)),fields:split(target.slice(open+1,-1)).map(identifier),select:parse(text.slice(c[1].start))};
 }
 const c=clauses(text,['SELECT','FROM','INTO','WHERE','GROUP BY','HAVING','ORDER BY','UPDATE','SET','DELETE']);
 const value=name=>{const k=c.findIndex(x=>x.name===name);return k<0?null:text.slice(c[k].end,c[k+1]?.start??text.length).trim();};
 if(head==='SELECT'){
  if(!value('FROM'))throw Error('Source-less SQL is outside the saved subset');
  let selected=value('SELECT'),distinct=false;if(/^DISTINCT(?:ROW)?\s+/i.test(selected)){distinct=true;selected=selected.replace(/^DISTINCT(?:ROW)?\s+/i,'');}
  return {kind:'select',distinct,columns:split(selected).map(column),from:from(value('FROM')),into:value('INTO')?identifier(value('INTO')):null,where:value('WHERE'),group:value('GROUP BY')?split(value('GROUP BY')):[],having:value('HAVING'),order:value('ORDER BY')?split(value('ORDER BY')).map(s=>({expression:s.replace(/\s+(?:DESC|ASC)$/i,'').trim(),descending:/\s+DESC$/i.test(s)})):[]};
 }
 if(head==='DELETE'){
  const first=split(value('DELETE'))[0],target=tokens(first)[0];if(!target||target.kind!=='name')throw Error('Invalid delete target');
  return {kind:'delete',target:target.value,from:from(value('FROM')),where:value('WHERE')};
 }
 if(head==='UPDATE'){
  const source=from(value('UPDATE'));const assignments=split(value('SET')).map(s=>{const eq=s.indexOf('=');if(eq<0)throw Error('Invalid assignment');const field=tokens(s.slice(0,eq));if(field.length!==3||field[1].value!=='.')throw Error('Qualified update field required');return {table:field[0].value,field:field[2].value,expression:s.slice(eq+1).trim()};});
  if(new Set(assignments.map(a=>a.table.toLowerCase())).size!==1)throw Error('Multiple update targets');
  return {kind:'update',target:assignments[0].table,from:source,where:value('WHERE'),assignments};
 }
 throw Error('Unsupported saved-query command '+head);
}
function compiler(plan,schemas,parameters={},options={}){
 const A=window.SolinAccessExpression,track=new Map(),aliases=new Map((plan.columns||[]).map(c=>[c.alias.toLowerCase(),c.expression]));
 const source=plan.from.sources;
 const find=s=>source.find(t=>t.alias.toLowerCase()===s.toLowerCase());
 function resolve(path,stack=[]){
  if(path.length===1&&plan.bindings?.[path[0].toLowerCase()])return resolve([plan.bindings[path[0].toLowerCase()],path[0]],stack);
  if(['forms','формы'].includes(path[0].toLowerCase())){
   if(path.length!==3||path[1]!=='ГОЛОВНОЕ МЕНЮ')throw Error('Unknown form parameter '+path.join('.'));
   const field={'ЛВ_1':'POS','Лес_1':'LESN',TE:'TE'}[path[2]];if(!field||parameters[field]==null)throw Error('Missing selection parameter '+path[2]);return A.sql({kind:'literal',value:parameters[field]},()=>{});
  }
  let t,k;
  if(path.length===2){t=find(path[0]);k=schemas[t?.name]?.find(f=>f.toLowerCase()===path[1].toLowerCase());}
  else if(path.length===1){
   const matches=source.flatMap(t=>(schemas[t.name]||[]).filter(k=>k.toLowerCase()===path[0].toLowerCase()).map(k=>[t,k]));
   if(matches.length===1)[t,k]=matches[0];
   else if(aliases.has(path[0].toLowerCase())){const key=path[0].toLowerCase();if(stack.includes(key))throw Error('Cyclic alias '+path[0]);return expr(aliases.get(key),[...stack,key]);}
   else throw Error((matches.length?'Ambiguous field ':'Missing field ')+path[0]);
  }
  if(!t||!k)throw Error('Missing field '+path.join('.'));
  (track.get(t.name)||track.set(t.name,new Set()).get(t.name)).add(k);
  return Q(t.alias)+'.'+Q(k);
 }
 function reference(path){
  if(path.length===1&&plan.bindings?.[path[0].toLowerCase()])return reference([plan.bindings[path[0].toLowerCase()],path[0]]);
  if(path.length===2){const t=find(path[0]);return t?[t.name,(schemas[t.name]||[]).find(k=>k.toLowerCase()===path[1].toLowerCase())]:null;}
  if(path.length===1){const matches=source.flatMap(t=>(schemas[t.name]||[]).filter(k=>k.toLowerCase()===path[0].toLowerCase()).map(k=>[t.name,k]));return matches.length===1?matches[0]:null;}
  return null;
 }
 function type(n){
  if(!n)return null;
  if(n.kind==='ref'){const r=reference(n.path);return r?options.types?.[r[0]]?.[r[1]]:null;}
  if(n.kind==='literal')return typeof n.value==='string'?10:typeof n.value==='number'?7:null;
  if(n.kind==='call'){if(['round','roundsingle','first','max','min'].includes(n.name))return type(n.args[0]);if(n.name==='iif')return type(n.args[1])===type(n.args[2])?type(n.args[1]):7;}
  return null;
 }
 function expand(n,stack=[]){
  if(n.kind==='ref'){
   if(['forms','формы'].includes(n.path[0].toLowerCase())){const field={'ЛВ_1':'POS','Лес_1':'LESN',TE:'TE'}[n.path[2]];if(!field||parameters[field]==null)throw Error('Missing form context '+n.path.join('.'));return {kind:'literal',value:parameters[field]};}
   if(n.path.length===1&&!reference(n.path)&&aliases.has(n.path[0].toLowerCase())){const key=n.path[0].toLowerCase();if(stack.includes(key))throw Error('Cyclic alias '+key);return expand(A.parse(aliases.get(key)),[...stack,key]);}
   return n;
  }
  if(n.kind==='call'){
   if(n.name==='date'&&!n.args.length)return {kind:'literal',value:options.date||new Date().toISOString().slice(0,10)};
   const copy={...n,args:n.args.map(a=>expand(a,stack))};
   if(copy.name==='nz'&&copy.args.length===1)copy.args.push({kind:'literal',value:''});
   if(['round','str'].includes(copy.name)&&type(copy.args[0])===6){copy.name+='single';if(copy.name==='roundsingle'&&copy.args.length===1)copy.args.push({kind:'literal',value:0});}
   return copy;
  }
  if(n.kind==='binary'){
   const copy={...n,left:expand(n.left,stack),right:expand(n.right,stack)},op={'=':'eqsingle','<>':'nesingle','<':'ltsingle','>':'gtsingle','<=':'lesingle','>=':'gesingle'}[n.op];
   return op&&(type(copy.left)===6||type(copy.right)===6)?{kind:'call',name:op,args:[copy.left,copy.right]}:copy;
  }
  if(n.arg)return {...n,arg:expand(n.arg,stack)};return n;
 }
 function expr(s,stack=[]){const ast=expand(A.parse(s),stack),sql=A.sql(ast,p=>resolve(p));return sql.length>1600&&options.scalar?options.scalar(ast,p=>resolve(p)):sql;}
 function joinExpr(s){
  // Preserve indexed equality for source joins. All saved joins in this bundle
  // compare columns. Both columns use the source text collation at installation.
  const ast=A.parse(s);
  function walk(n){if(n.kind==='binary'&&n.op==='and')return '('+walk(n.left)+' AND '+walk(n.right)+')';if(n.kind==='binary'&&n.op==='='&&n.left.kind==='ref'&&n.right.kind==='ref')return '('+resolve(n.left.path)+' = '+resolve(n.right.path)+')';return A.sql(n,p=>resolve(p));}
  return walk(ast);
 }
 function sqlFrom(n){if(n.kind==='table'){if(!schemas[n.name])throw Error('Missing table '+n.name);return Q(n.name)+(n.alias!==n.name?' AS '+Q(n.alias):'');}return '('+sqlFrom(n.left)+' '+n.join+' JOIN '+sqlFrom(n.right)+(n.on?' ON '+joinExpr(n.on):'')+')';}
 const fromSql=sqlFrom(plan.from.ast),where=plan.where?' WHERE '+expr(plan.where):'';
 if(plan.kind==='delete')return {sql:'SELECT '+resolve([plan.target,'__rid'])+' AS __target FROM '+fromSql+where,track};
 if(plan.kind==='update')return {sql:'SELECT '+resolve([plan.target,'POS'])+' AS POS,'+resolve([plan.target,'LESN'])+' AS LESN,'+resolve([plan.target,'KV'])+' AS KV,'+resolve([plan.target,'KGLF'])+' AS KGLF,'+resolve([plan.target,'VD'])+' AS VD,'+plan.assignments.map(a=>expr(a.expression)+' AS '+Q(a.field)).join(',')+' FROM '+fromSql+where,track};
 const columns=[];for(const c of plan.columns){
  if(c.expression==='*'){for(const s of source)for(const k of schemas[s.name]||[])columns.push({expression:Q(s.alias)+'.'+Q(k),alias:k});}
  else if(/^[\p{L}\p{N}_\[\]]+\.\*$/u.test(c.expression)){const t=find(tokens(c.expression)[0].value);if(!t)throw Error('Unknown wildcard source');for(const k of schemas[t.name])columns.push({expression:Q(t.alias)+'.'+Q(k),alias:k});}
  else columns.push({expression:expr(c.expression),alias:c.alias});
 }
 let sql='SELECT '+(plan.distinct?'DISTINCT ':'')+columns.map(c=>c.expression+' AS '+Q(c.alias)).join(',')+' FROM '+fromSql+where;
 if(plan.group.length)sql+=' GROUP BY '+plan.group.map(s=>expr(s)).join(',');
 if(plan.having)sql+=' HAVING '+expr(plan.having);
 if(plan.order.length&&!options.noOrder)sql+=' ORDER BY '+plan.order.map(s=>expr(s.expression)+(s.descending?' DESC':'')).join(',');
 return {sql,columns:columns.map(c=>c.alias),types:Object.fromEntries(plan.columns.filter(c=>!c.expression.includes('*')).map(c=>[c.alias,type(expand(A.parse(c.expression)))])),track};
}
window.SolinAccessSQL={tokens,split,clauses,parse,compiler,quote:Q};
})();
