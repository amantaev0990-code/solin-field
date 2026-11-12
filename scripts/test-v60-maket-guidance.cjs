'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const mod=fs.readFileSync('solin-category-rules.js','utf8');
const sandbox={window:{}};
vm.runInNewContext(mod,sandbox);
const rules=sandbox.window.SolinCategoryRules;
assert.equal(typeof rules.maketRequirements,'function');
const lookup={SKU:[
 {KU:31,NKU:'Дорога',P31:1,PF1:1,P10:0,GrMak:1},
 {KU:1,NKU:'Насаждение',P31:1,PF1:1,P10:1,GrMak:4}
]};
for(const code of [31,1]){
 const p=rules.profile(code,lookup),required=rules.maketRequirements(code,lookup);
 assert.equal(p.code,code,'KU lookup must remain unchanged');
 assert.equal(required.status,'unverified');
 assert.equal(required.required,null,'Unknown requirements must not be represented as an empty/known list');
 assert.match(required.reason,/не являются списком обязательных макетов/);
}
assert.equal(rules.profile(31,lookup).name,'Дорога');
const quick=fs.readFileSync('solin-quick-card.js','utf8');
assert.match(quick,/maketRequirements\?\.\(code/);
assert.doesNotMatch(quick,/enabled:p\.p31/);
assert.doesNotMatch(quick,/enabled:p\.form1/);
assert.doesNotMatch(quick,/button\('М'\+item\.n/);
assert.match(quick,/Категория '\+p\.code/);
assert.match(quick,/макетам|Макеты|makets/);
const css=fs.readFileSync('solin-quick-card.css','utf8');
assert.match(css,/ce-required-makets/);
assert.match(css,/background:#f6f7f8/);
console.log('V60_MAKET_GUIDANCE_OK: no misleading M31 or M1 for road KU31, source flag values preserved, no invented mandatory requirements');
