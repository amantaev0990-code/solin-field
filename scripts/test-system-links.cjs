/* Cross-module regression for KTO→Raion, KGLF→SFZ, and
 * forest→quarter→stand→maket referential integrity.
 * Read-only fixtures; no user forest records are changed.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const window={
 SOLIN_REFS:{tables:{SFZ:[
  {KLF:54,KFZ:1,NFZK:'Заповедный режим'},
  {KLF:27,KFZ:3,NFZK:'Другая зона'}]}},
 SolinWorkspace:{ready:Promise.resolve(),list:async()=>[]},
 addEventListener:()=>{},
 SolinDependentRules:{validateTransition:()=>({errors:[],warnings:[]})},
 SolinCardCalculations:{standStock:()=>({status:'complete'})},
 SOLIN_AUDIT:{summary:{formCount:554,rowSources:321,validationRules:203}}
};
const D={lesnichestvo:[{POS:213,LESN:2,KTO:150000000}],quarters:{
 1:{meta:{POS:213,LESN:2,KV:1,KGLF:54,Fzona:1,Raion:156000000,Klxr:3},
 compartments:[]}
}};
const context=vm.createContext({window,D,document:{},Option:class{}});
for(const path of ['solin-forest-catalog.js','solin-address-context.js',
 'solin-quarter-pickers.js','solin-dependency-audit.js'])
 vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
const catalog=window.SOLIN_FOREST_CATALOG.rows;
assert.equal(catalog.length,877,'Original KUch active rows must remain complete');
assert.equal(catalog.filter(x=>Number(x[1])>0).length,644);
assert.equal(catalog.filter(x=>Number(x[1])===0).length,233);
const region=(code)=>Number(window.SolinQuarterPickers.districtRegion(code));
assert.equal(region('153200000'),150000000);
assert.equal(region('356400000'),350000000);
const kt=window.SolinQuarterPickers;
const act={POS:213,LESN:2,KTO:150000000},
      kar={POS:723,LESN:4,KTO:350000000};
assert.equal(kt.candidates('Raion',{},act).items.length,12);
assert(!kt.candidates('Raion',{},act).items.some(x=>x.value==='356400000'));
assert.equal(kt.candidates('Raion',{},kar).items.length,1);
assert.equal(kt.candidates('Raion',{},kar).items[0].value,'356400000');
assert.equal(kt.validateDistrict('356400000',act).status,'mismatch');
assert.equal(kt.validateDistrict('156000000',act).status,'matched');
assert.equal(kt.validateDistrict('356400000',kar).status,'matched');
assert.equal(kt.candidates('Raion',{},{}).items.length,0);
assert.deepEqual(Array.from(kt.candidates('Fzona',{KGLF:54},act).items,x=>x.value),['0','1']);
assert.deepEqual(Array.from(kt.candidates('Fzona',{KGLF:27},act).items,x=>x.value),['0','3']);
assert.deepEqual(Array.from(kt.candidates('Fzona',{},act).items,x=>x.value),['0']);
const address={POS:213,LESN:2,KV:1,KGLF:54,VD:'1'};
const make=(props={})=>({...address,PLV:2,Fzona:1,KlxrVD:3,
 _children:{Макет10:[{...address,IAR:1,POR:'ОС',KOEF:10,ZAP:30}]},...props});
const audit=window.SolinDependencyAudit;
assert.equal(audit.checkOne(make(),act).errors.length,0,'Consistent chain must pass');
let bad=audit.checkOne(make({KGLF:27}),act);
assert(bad.errors.some(x=>x.field==='KGLF'),'Quarter category mismatch must be flagged');
bad=audit.checkOne(make({_children:{Макет10:[{...address,VD:'77'}]}}),act);
assert(bad.errors.some(x=>x.form==='Макет10'&&x.field==='VD'),'Foreign stand address must be flagged');
D.quarters['1'].meta.Raion=356400000;
bad=audit.checkOne(make(),act);
assert(bad.errors.some(x=>x.form==='Квартал'&&x.field==='Raion'),'Wrong oblast KATO must be flagged');
D.quarters['1'].meta.Raion=156000000;
assert.equal(audit.coverage().archivedRowSources,321);
assert.equal(audit.coverage().districtOriginalTableAvailable,false);
assert.equal(audit.coverage().sourceCoverage,'partial','Never claim all Access rules are ported');
console.log('SYSTEM_LINKS_OK: 877 KUch rows, 14 historical region registry, isolated KATO districts, KGLF/SFZ linkage, quarter→stand→maket integrity, missing-source transparency');
