#!/usr/bin/env node
'use strict';
// Private differential proof from existing saved form literals and Jet
// QueryDefs. Only trusted read-only Access expressions are interpreted.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const [formFile,inventoryFile,output]=process.argv.slice(2);if(!output)throw Error('Usage: node cloud-lab/verify-functional-zones.cjs PRIVATE_FORM_EVIDENCE.json PRIVATE_INVENTORY.json PRIVATE_OUTPUT.json');
const root=path.resolve(__dirname,'..'),target=path.resolve(output);if(target.startsWith(root+path.sep))throw Error('Detailed source evidence must stay outside public git');
const report=JSON.parse(fs.readFileSync(formFile)),inventory=JSON.parse(fs.readFileSync(inventoryFile)),window={};
for(const f of ['solin-access-expression.js','solin-access-sql.js','solin-dependent-rules.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window});
const A=window.SolinAccessExpression,E=window.SolinDependentRules,refs={SFZ:inventory.rows.SFZ};
const categories=[...Array(37).keys(),54,999],cases=[];
function check(where,frontend,form,category,source){
 const ast=A.parse(where),resolve=(row,parts)=>{
  if(parts.length===2&&parts[0].toLowerCase()==='sfz')return row[parts[1]];
  if(parts.length===3&&parts[0].toLowerCase()==='forms'&&parts[1]===form&&['KGLF','KGLF2'].includes(parts[2]))return category;
  throw Error('Unresolved original identifier '+parts.join('.'));
 };
 const original=refs.SFZ.filter(r=>A.evaluate(ast,p=>resolve(r,p))===-1).map(r=>Number(r.KFZ)).sort((a,b)=>a-b);
 const actual=E.functionalZones({KGLF:category},refs,{frontend,form}).items.map(r=>Number(r.value));
 const passed=JSON.stringify(original)===JSON.stringify(actual);cases.push({frontend,form,category,source,original,actual,passed});
}
for(const [frontend,forms]of Object.entries(report.form_rowsource))for(const [form,evidence]of Object.entries(forms)){
 const plan=window.SolinAccessSQL.parse(evidence.sql);for(const c of categories)check(plan.where,frontend,form,c,'serialized-form-literal');
}
const edit=inventory.queries.find(q=>q.name==='~sq_cКвартал~sq_cFzona');
for(const c of categories)check(edit.attributes.find(a=>a.Attribute===8).Expression,'Solim','Квартал',c,'direct-MSysQueries');
const result={passed:cases.every(c=>c.passed),cases:cases.length,nativeAccessExecuted:false,eventBindingVerified:false,results:cases};
fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,cases:result.cases,failed:cases.filter(c=>!c.passed).length}));if(!result.passed)process.exitCode=1;
