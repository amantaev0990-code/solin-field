'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync('solin-dependent-rules.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync('solin-dependency-audit.js','utf8'),ctx);
const refs={
 SDP_Tip:[{KPC:'В',NDP:'Вяз',DKP2:202500},{KPC:'Б',NDP:'Берёза',DKP2:302600}],
 SDP:[{KPC:'В',NDP:'Вяз',DKP2:202500,ОбПор:'В'}],
 SLM:[{KM:0,PM2R:0},{KM:10,PM2R:1}],
 SKU:[{KU:2,NKU:'Лесные культуры',P10:5}],
 SIAR:[{Ia:5,KIAR:1,NIAR:'Ярус I'}],PIAP:[{KIAR:1}],
 STL:[{GPor:'В',Lxz:8,OblStl:15,GrTL:0,KTL:'ВРТЗ',NTL:'Вязовник'}]
};
const org={KTO:150000000};
const ok={POS:213,LESN:2,KV:1,KGLF:1,VD:1,
 KU:2,KlxrVD:8,M3Pr:'В',M3TLU:'ВРТЗ',NE2A:0,M2PM1:10,
 _children:{Макет10:[{IAR:1,POR:'В'}],Макет16:[{Por16:'В'}]}};
const bad=JSON.parse(JSON.stringify(ok));bad.VD=2;bad.M2PM1=999;bad._children.Макет16[0].Por16='Б';
const before=JSON.stringify([ok,bad]);
const report=ctx.window.SolinDependencyAudit.scan([ok,bad],org,refs);
assert.equal(report.records,2);
assert.equal(report.affected,1);
assert(report.errors>=2);
assert.equal(report.results[0].address,'213/2/1/1/2');
assert(report.results[0].errors.some(x=>x.form==='ВыделВ'&&x.field==='M2PM1'));
assert(report.results[0].errors.some(x=>x.form==='Макет16'&&x.field==='Por16'));
assert.equal(JSON.stringify([ok,bad]),before,'Scan must NEVER write workspace or stand');
const limited=ctx.window.SolinDependencyAudit.scan([ok],org,{...refs,STL:[]});
assert(limited.warnings>0,'Incomplete source must be labelled unverified, not verified');
assert.equal(limited.errors,0);
// Missing reference tables are "not verified", NEVER fabricated invalid
// codes, and an unrelated missing name table cannot disable a real
// Maket10 -> Maket16 composition relationship.
const absent=ctx.window.SolinDependencyAudit.scan([ok],org,{
 ...refs,SDP_Tip:[],SLM:[],SSP:[],SBR:[],SOV:[]});
assert.equal(absent.errors,0,'Missing lookup rows must not fabricate errors');
assert(absent.results[0].warnings.some(x=>x.field==='M3Pr'),
 'Unavailable main-species dictionary must be explicitly marked');
assert(absent.results[0].warnings.some(x=>x.field==='M2PM1'),
 'Unavailable measures table must be explicitly marked');
const linked={...ok,_children:{...ok._children,Макет16:[{Por16:'Б'}]}};
const stillLinked=ctx.window.SolinDependencyAudit.scan([linked],org,{
 ...refs,SDP:[]});
assert(stillLinked.results[0].errors.some(x=>x.field==='Por16'),
 'Maket16 must use actual Maket10 composition even if SDP labels unavailable');
// Excel-safe, Russian-language, semicolon separated report including
// literal BOM/CRLF and all issues (not only first 120 shown in UI).
const injected={...report,results:[{
 address:'=1+1',errors:[{form:'Макет12',field:'SV',value:'=2+2',
   reason:'=HYPERLINK("https://example.test")',index:0}],warnings:[]
}]};
const csv=ctx.window.SolinDependencyAudit.csv(injected);
assert(csv.startsWith('\uFEFF'),'CSV must have real UTF-8 BOM for Russian Excel');
assert(csv.includes('\r\n'),'Excel CSV must use CRLF');
assert(csv.includes('"\'=1+1"'),'Address must not execute Excel formulas');
assert(csv.includes('"\'=2+2"'),'Code must not execute Excel formulas');
assert(csv.includes('"\'=HYPERLINK(""https://example.test"")"'),
 'Description must escape quotes and never execute Excel formulas');
assert.equal(JSON.stringify([ok,bad]),before,'CSV export must not mutate the forest');
const workflow=fs.readFileSync('solin-workflow.js','utf8');
for(const id of ['wfCardRelations','wfQuarterRelations','wfForestDependencyAudit'])
 assert(workflow.includes(id),'Missing scope entry point '+id);
const page=fs.readFileSync('index.html','utf8');
assert(page.includes('solin-dependency-audit.js'),'Audit must be loaded in deployed PWA');
console.log('DEPENDENCY_AUDIT_OK 3 scopes, complete card scan, source-unverified warnings, data immutability');
