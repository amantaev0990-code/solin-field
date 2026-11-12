'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync('solin-category-rules.js','utf8'),sandbox);
const rules=sandbox.window.SolinCategoryRules;
const mock={SKU:[
 {KU:31,NKU:'Дорога',P31:3,PF1:1,P10:0,PM:13},
 {KU:43,NKU:'Плантация',P31:1,PF1:1,P10:0,PM:3},
 {KU:1,NKU:'Насаждение',P31:3,PF1:1,P10:1,PM:0}
]};
function req(ku,refs=mock){return JSON.parse(JSON.stringify(rules.maketRequirements(ku,refs)))}
const road=req(31);
assert.equal(road.status,'partially-confirmed');
assert.deepEqual(road.required.map(x=>x.number),[13]);
assert.equal(road.required[0].control,'К02');
assert.deepEqual(road.required[0].fields,['SHT','PRT']);
assert.equal(road.complete,false,'Never claim the original mandatory-maket matrix is fully ported');
assert.deepEqual(req(43).required.map(x=>x.number),[25],'PM=3 is independently verified as Maket25');
assert.equal(req(1).required,null,'P31/PF1 flags are not Maket31/Maket1 requirements');
const compact=req(31,{SKU:[{KU:31,NKU:'Дорога'}]});
assert.deepEqual(compact.required.map(x=>x.number),[13],'Original KU31 SKU PM=13 crosswalk is confirmed');
const different=req(31,{SKU:[{KU:31,NKU:'Дорога',PM:0,P31:3,PF1:1}]});
assert.equal(different.required,null,'Never override an explicitly different incoming source SKU.PM');
const quick=fs.readFileSync('solin-quick-card.js','utf8');
assert.match(quick,/requirements\?\.required/);
assert.match(quick,/editor\.showExtra\('Макет'\+maket\)/);
assert.doesNotMatch(quick,/enabled:p\.p31/);
assert.doesNotMatch(quick,/enabled:p\.form1/);
console.log('V61_KU31_M13_OK: exact source SKU.PM=13 => K02/Maket13, PM=3 => M25, no M31/M1 invented; source changes remain protected');
