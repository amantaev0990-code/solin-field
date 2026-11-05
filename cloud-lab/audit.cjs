#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'..'),[input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node cloud-lab/audit.cjs PRIVATE_INVENTORY_DIRECTORY PRIVATE_OUTPUT_DIRECTORY');
const {compare,compareRegeneratedSql}=require('./query-contract.cjs');
const src=path.resolve(input),out=path.resolve(output);if(out.startsWith(root+path.sep))throw Error('Detailed source registry is private; choose an output outside the public repo');fs.mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),window={};
for(const f of ['solin-native-control-data.js','solin-audit-data.js','solin-sql-source.js','solin-field-types.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window});
const N=window.SOLIN_NATIVE_CONTROL_DATA,A=window.SOLIN_AUDIT,nodes=new Map(),edges=[],rules=[],sources=[];
const node=(id,data)=>{nodes.set(id,{id,...data});return id;};
const norm=s=>String(s??'').replace(/\s+/g,' ').trim().toLocaleUpperCase('ru-RU');
const enriched=new Map(fs.readdirSync(src).filter(n=>n.endsWith('-jackcess.json')).map(n=>read(path.join(src,n))).filter(d=>d.originalUnchanged).map(d=>[d.source.name,d]));
const joinChecks=[];
const appBindings={'Макет16Созд':'sourceRows','Макет16Пересчет':'parameterPreview','Макет10Пол1ЯрЛ':'sourceRows'};
for(const f of fs.readdirSync(src).filter(n=>n.endsWith('-inventory.json'))){
 const d=read(path.join(src,f));if(!d.source||!Array.isArray(d.tables))continue;sources.push({...d.source,tableCount:d.tables.length,queryCount:d.queries.length,errors:d.errors});
 const prefix=d.source.name,details=enriched.get(prefix),savedSql=new Map((details?.queries||[]).map(q=>[q.name,q.sql])),tableDetails=new Map((details?.tables||[]).map(t=>[t.name,t]));
 if(details&&details.source.sha256!==d.source.sha256)throw Error('Enriched source hash mismatch: '+prefix);
 for(const t of d.tables){const extra=tableDetails.get(t.name);node(prefix+':table:'+t.name,{kind:'table',source:prefix,name:t.name,rows:t.rowCount,columns:t.columns,indexes:extra?.indexes,properties:extra?.properties});
  for(const c of t.columns||[]){const prop=extra?.columns.find(v=>v.name===c.name)?.properties;const id=prefix+':field:'+t.name+'.'+c.name;node(id,{kind:'field',table:t.name,name:c.name,type:c.type,properties:prop});
   if(prop)for(const [property,value]of Object.entries(prop))if(property==='DefaultValue'||property==='Required'&&value===true||property==='AllowZeroLength'&&value===false)
    rules.push({id:id+':'+property,kind:'table-field-property',source:prefix,table:t.name,field:c.name,property,value,status:'unverified',verification:'Direct read-only property inventory; no automatic overwrite or form binding inferred'});
   if(prefix==='Transf_213_2_2026.mdb'&&window.SolinFieldTypes.type(t.name,c.name)===c.type){
    const target=node('Field:SolinFieldTypes.read',{kind:'implementation',file:'solin-field-types.js',function:'read'});
    rules.push({id:id+':editor-type',kind:'typed-editor-field',source:prefix,table:t.name,field:c.name,type:c.type,status:'partial',implementation:{file:'solin-field-types.js',function:'read'},verification:'Original Transfer type; untouched scalar preservation and edited type validation; native Access UI semantics are separate'});
    edges.push({from:id,to:target,relation:'editor-type-contract',status:'source-schema-verified'});
   }
  }
 }
 for(const q of d.queries){
  const id=node(prefix+':query:'+q.name,{kind:'query',name:q.name,source:prefix});
  const p=prefix==='Solim.mdb'?N.queries[q.name]:null;
  const attrs=q.attributes,contract=compare(q,p),componentsMatch=contract.status==='matched';
  const regenerated=p&&savedSql.has(q.name)?compareRegeneratedSql(savedSql.get(q.name),p):null;
  if(regenerated)joinChecks.push({source:prefix,name:q.name,...regenerated});
  const binding=prefix==='Solim.mdb'?appBindings[q.name]:null;
  if(binding){const target=node('Field:SolinMaket16.'+binding,{kind:'implementation',file:'solin-maket16.js',function:binding});edges.push({from:id,to:target,relation:'saved-query-implementation',status:'isolated-source-replay; native-Access-unverified'});}
  rules.push({id,kind:'saved-query',source:prefix,name:q.name,sourceAttributes:attrs,
   implementation:p?{file:'solin-native-control-data.js',hash:p.sourceHash}:null,
   appImplementation:binding?{file:'solin-maket16.js',function:binding}:null,
   status:p||binding?'partial':'absent',sourceComponentsMatch:componentsMatch,definitionContract:contract,regeneratedJoinContract:regenerated,
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
const vbaFile=path.join(src,'vba-inventory.json');let vba=null;
if(fs.existsSync(vbaFile)){vba=read(vbaFile);if(vba.activeDirReextractedThisRun)for(const m of vba.activeDirectory.modules)for(const procedure of m.procedures)
 rules.push({kind:'active-vba-procedure',module:m.module,procedure,sourceSha256:m.sha256,status:'unverified',verification:'Current source hash verified against saved reference; runtime/event binding not executed'});}
// Stable source identities are independent of implementation/test status.
// Repeated source entries retain an occurrence suffix rather than disappearing.
const identifiers=new Map();
for(const rule of rules){
 if(!rule.id){const source=Object.fromEntries(['kind','source','form','name','field','module','procedure','rule','expression','caption','target','macro'].filter(k=>rule[k]!==undefined).map(k=>[k,rule[k]]));rule.id='Rule:'+crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex').slice(0,24);}
 const original=rule.id,count=(identifiers.get(original)||0)+1;identifiers.set(original,count);if(count>1)rule.id=original+':'+count;
}
if(new Set(rules.map(r=>r.id)).size!==rules.length)throw Error('Rule identifiers are not unique');
const refs=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(root,'refs-audit.json.gz'))));
const solim=sources.find(s=>s.name==='Solim.mdb'),planCount=Object.keys(N.queries).length;
const coverage={generatedAt:new Date().toISOString(),overallCoveragePercent:null,
 reason:'No complete weighted behavioral denominator or full native Access replay exists. Inventory and parsed plans are not completed behavior.',
 categories:[
  {category:'Solim saved-query inventory',discovered:solim?.queryCount,inventoried:solim?.queryCount,status:'implemented',scope:'Direct read of MSysQueries and MSysObjects'},
  {category:'Solim saved-query plans in mobile control runtime',discovered:solim?.queryCount,present:planCount,inventoryPercent:solim?Math.round(planCount/solim.queryCount*1000)/10:null,status:'partial'},
  {category:'Current source SQL component comparison',tested:rules.filter(r=>r.kind==='saved-query'&&r.implementation).length,matched:rules.filter(r=>r.sourceComponentsMatch).length,status:'partial',scope:'Ordered projections, aliases, actions, targets, predicates, grouping, sorting and source tables. Native execution and join-tree precedence are separate.'},
  {category:'Normative reference tables bundled previously',present:Object.keys(refs.tables).length,status:'partial'},
  {category:'Saved form inventory',discovered:A.summary.formCount,rowSources:A.summary.rowSources,validationRules:A.validations.length,formExpressions:A.formulas.length,status:'partial'},
  {category:'Original control definition comparison',matchedPreviously:N.source.definitionsMatched,comparedPreviously:N.source.definitionsCompared,status:'partial',scope:'Saved prior Access comparison; not re-executed on Access this session'},
  {category:'Fzona saved RowSource profiles',status:'partial',scope:'Solim/Database, create/edit predicates restored. Original Access event execution is unverified.'},
  {category:'Regenerated saved-query join contracts',tested:joinChecks.length,matched:joinChecks.filter(c=>c.status==='matched').length,status:'partial',scope:'Independent Jackcess SQL serialization; original Access execution remains unverified'},
  {category:'Table DefaultValue/Required/AllowZeroLength rules',inventoried:rules.filter(r=>r.kind==='table-field-property').length,status:'unverified',scope:'Original properties recorded without silently replacing entered values'},
  {category:'Current active VBA directory',modules:vba?.activeDirectory?.moduleCount,procedures:vba?.activeDirectory?.procedureCount,sourceHashesMatched:vba?.activeDirectory?.sourceHashesMatched,status:vba?.activeDirReextractedThisRun?'partial':'unverified',scope:'Direct read-only extraction; no VBA execution or event binding inferred'},
  {category:'Typed editor fields',fields:rules.filter(r=>r.kind==='typed-editor-field').length,status:'partial',scope:'Both editors use confirmed Transfer types and preserve untouched values; Access widget equivalence is not claimed'},
  {category:'Maket16 saved action implementations',definitions:Object.keys(appBindings).length,status:'partial',scope:'Append and five-field refresh with ambiguity guards; original macro ordering and Access target coercion remain unverified'},
  {category:'Physical Android and desktop reopening',status:'unverified'}],sources};
const meta=read(path.join(root,'data-meta.json'));
const makets=Object.entries(meta.transfSchema).map(([name,fields])=>({name,fields,storage:'transfer-table',rules:rules.filter(r=>r.form===name).length,status:'partial'}));
for(const n of [1,2,3,4,5,31,32])makets.push({name:'Макет'+n,storage:'stand-fields-or-form; original binding requires review',status:'unverified'});
for(const [name,data]of Object.entries({'rules.json':rules,'dependencies.json':{nodes:[...nodes.values()],edges},'coverage.json':coverage,'makets.json':makets,'regenerated-join-contracts.json':joinChecks}))fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2));
console.log(JSON.stringify({sources:sources.map(s=>({name:s.name,tables:s.tableCount,queries:s.queryCount})),rules:rules.length,nodes:nodes.size,edges:edges.length,planCount,sourceComponentsMatched:coverage.categories[2].matched,output:out}));
