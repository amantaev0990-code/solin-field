#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'..'),[input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node cloud-lab/audit.cjs PRIVATE_INVENTORY_DIRECTORY PRIVATE_OUTPUT_DIRECTORY');
const {compare}=require('./query-contract.cjs');
const src=path.resolve(input),out=path.resolve(output);if(out.startsWith(root+path.sep))throw Error('Detailed source registry is private; choose an output outside the public repo');fs.mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),window={};
for(const f of ['solin-native-control-data.js','solin-audit-data.js','solin-sql-source.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window});
const N=window.SOLIN_NATIVE_CONTROL_DATA,A=window.SOLIN_AUDIT,nodes=new Map(),edges=[],rules=[],sources=[];
const node=(id,data)=>{nodes.set(id,{id,...data});return id;};
const norm=s=>String(s??'').replace(/\s+/g,' ').trim().toLocaleUpperCase('ru-RU');
for(const f of fs.readdirSync(src).filter(n=>n.endsWith('-inventory.json'))){
 const d=read(path.join(src,f));if(!d.source||!Array.isArray(d.tables))continue;sources.push({...d.source,tableCount:d.tables.length,queryCount:d.queries.length,errors:d.errors});
 const prefix=d.source.name;
 for(const t of d.tables){node(prefix+':table:'+t.name,{kind:'table',source:prefix,name:t.name,rows:t.rowCount,columns:t.columns});for(const c of t.columns||[])node(prefix+':field:'+t.name+'.'+c.name,{kind:'field',table:t.name,name:c.name,type:c.type});}
 for(const q of d.queries){
  const id=node(prefix+':query:'+q.name,{kind:'query',name:q.name,source:prefix});
  const p=prefix==='Solim.mdb'?N.queries[q.name]:null;
  const attrs=q.attributes,contract=compare(q,p),componentsMatch=contract.status==='matched';
  rules.push({id,kind:'saved-query',source:prefix,name:q.name,sourceAttributes:attrs,
   implementation:p?{file:'solin-native-control-data.js',hash:p.sourceHash}:null,
   status:p?'partial':'absent',sourceComponentsMatch:componentsMatch,definitionContract:contract,
   verification:p?'parsed-plan-present; Access runtime parity is separate':'unverified'});
  for(const a of attrs){
   if(a.Attribute===5&&a.Name1)edges.push({from:prefix+':table:'+a.Name1,to:id,relation:'query-source',evidence:{attribute:5}});
   if(a.Expression){for(const m of a.Expression.matchAll(/([\p{L}_][\p{L}\p{N}_]*)[.!]\[?([\p{L}_][\p{L}\p{N}_]*)\]?/gu))edges.push({from:prefix+':field:'+m[1]+'.'+m[2],to:id,relation:'expression-reference',evidence:{attribute:a.Attribute},status:'lexical-reference'});}
  }
 }
}
for(const v of A.validations||[])rules.push({kind:'validation',form:v.form,field:v.name,source:v.source,rule:v.rule,status:'unverified',implementation:null});
for(const v of A.formulas||[])rules.push({kind:'form-expression',...v,status:'unverified'});
for(const v of window.SOLIN_LOOKUP_SOURCES||[])rules.push({kind:'lookup-binding',...v,status:'partial',runtimeBindingVerified:false});
for(const [form,routes]of Object.entries(A.routes||{}))for(const route of routes)rules.push({kind:'form-route',form,...route,status:'unverified'});
const refs=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(root,'refs-audit.json.gz'))));
const solim=sources.find(s=>s.name==='Solim.mdb'),planCount=Object.keys(N.queries).length;
const coverage={generatedAt:new Date().toISOString(),overallCoveragePercent:null,
 reason:'No complete weighted behavioral denominator or full native Access replay exists. Inventory and parsed plans are not completed behavior.',
 categories:[
  {category:'Solim saved-query inventory',discovered:solim?.queryCount,inventoried:solim?.queryCount,status:'implemented',scope:'Direct read of MSysQueries and MSysObjects'},
  {category:'Solim saved-query plans in mobile control runtime',discovered:solim?.queryCount,present:planCount,inventoryPercent:solim?Math.round(planCount/solim.queryCount*1000)/10:null,status:'partial'},
  {category:'Current source SQL component comparison',tested:rules.filter(r=>r.implementation).length,matched:rules.filter(r=>r.sourceComponentsMatch).length,status:'partial',scope:'Ordered projections, aliases, actions, targets, predicates, grouping, sorting and source tables. Native execution and join-tree precedence are separate.'},
  {category:'Normative reference tables bundled previously',present:Object.keys(refs.tables).length,status:'partial'},
  {category:'Saved form inventory',discovered:A.summary.formCount,rowSources:A.summary.rowSources,validationRules:A.validations.length,formExpressions:A.formulas.length,status:'partial'},
  {category:'Original control definition comparison',matchedPreviously:N.source.definitionsMatched,comparedPreviously:N.source.definitionsCompared,status:'partial',scope:'Saved prior Access comparison; not re-executed on Access this session'},
  {category:'Fzona saved RowSource profiles',status:'partial',scope:'Solim/Database, create/edit predicates restored. Original Access event execution is unverified.'},
  {category:'Physical Android and desktop reopening',status:'unverified'}],sources};
const meta=read(path.join(root,'data-meta.json'));
const makets=Object.entries(meta.transfSchema).map(([name,fields])=>({name,fields,storage:'transfer-table',rules:rules.filter(r=>r.form===name).length,status:'partial'}));
for(const n of [1,2,3,4,5,31,32])makets.push({name:'Макет'+n,storage:'stand-fields-or-form; original binding requires review',status:'unverified'});
for(const [name,data]of Object.entries({'rules.json':rules,'dependencies.json':{nodes:[...nodes.values()],edges},'coverage.json':coverage,'makets.json':makets}))fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2));
console.log(JSON.stringify({sources:sources.map(s=>({name:s.name,tables:s.tableCount,queries:s.queryCount})),rules:rules.length,nodes:nodes.size,edges:edges.length,planCount,sourceComponentsMatched:coverage.categories[2].matched,output:out}));
