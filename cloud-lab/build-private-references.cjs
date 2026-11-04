#!/usr/bin/env node
'use strict';
// Writes only to a private destination; never commits normative source rows.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto');
function pack(inventory){
 const soato=inventory.rows.СОАТО,piap=inventory.rows.PIAP;
 if(!Array.isArray(soato)||!Array.isArray(piap))throw Error('Inventory requires original СОАТО and PIAP rows');
 const definition=inventory.queries.find(q=>q.name==='Кл_Рай');if(!definition)throw Error('Original Кл_Рай definition missing');
 const predicate=definition.attributes.find(a=>a.Attribute===8)?.Expression;
 const expected='(((СОАТО.cd)<>0) AND ((СОАТО.ef)=0 Or (СОАТО.ef)=20) AND ((СОАТО.hij)=0)) OR (((СОАТО.ab)>70) AND ((СОАТО.ef)=10))';
 if(predicate!==expected)throw Error('Reverify changed Кл_Рай predicate');
 const notNull=v=>v!==null&&v!==undefined;
 const columns=definition.attributes.filter(a=>a.Attribute===6);
 const districts=soato.filter(r=>(notNull(r.cd)&&r.cd!==0&&(r.ef===0||r.ef===20)&&r.hij===0)||(notNull(r.ab)&&r.ab>70&&r.ef===10))
  .map(r=>Object.fromEntries(columns.map(a=>{
   const field=/^СОАТО\.(.+)$/.exec(a.Expression);
   if(field)return [a.Name1||field[1],r[field[1]]];
   if(a.Name1==='ТЕОб')return ['ТЕОб',Math.floor(r.te/10000000)*10000000];
   if(a.Expression==='""'&&['kaz_nameK','rus_nameK'].includes(a.Name1))return [a.Name1,''];
   throw Error('Unverified Кл_Рай projection');
  }))).sort((a,b)=>a.ab-b.ab||a.te-b.te);
 return {format:'SOLIN-private-reference-supplement-v1',sourceSha256:inventory.source.sha256,
  queryEvidence:crypto.createHash('sha256').update(JSON.stringify(definition.attributes)).digest('hex'),
  tables:{PIAP:piap,'Кл_Рай':districts},limitations:['Historical source version; current national KATO equivalence has not been verified','Fzona complete saved-form predicate remains unverified']};
}
if(require.main===module){const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node cloud-lab/build-private-references.cjs PRIVATE_INVENTORY.json PRIVATE_OUTPUT.bin');
 const root=path.resolve(__dirname,'..'),dest=path.resolve(output);if(dest.startsWith(root+path.sep))throw Error('Keep recovered source rows outside public git');
 const result=pack(JSON.parse(fs.readFileSync(input,'utf8')));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,z.gzipSync(JSON.stringify(result),{level:9}));
 console.log(JSON.stringify({tables:Object.fromEntries(Object.entries(result.tables).map(([k,v])=>[k,v.length])),sha256:crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex'),output:dest}));}
module.exports={pack};
