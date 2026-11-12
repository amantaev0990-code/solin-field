'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync('solin-category-rules.js','utf8'),ctx);
const rules=ctx.window.SolinCategoryRules;
// Exact 123 original Solim.SKU active categories grouped by stored SKU.PM,
// independently decoded from SOLIN_P31_KUPLP_CROSSWALK_2026-10-22.json.
const PM={
1:[1,5,6,9],
2:[2,4,7,19],
3:[43,44],
5:[10,11,12,13,14,15,16],
6:[17],
7:[20,21,22,41,42,79,80,81],
8:[23,24,54],
9:[26,112,127],
10:[25,77],
12:[92],
13:[27,28,29,30,31,33,34,35,36,45,46,47,48,49,55,56,76,90,114],
14:[58],
17:[37,38,39,40,52,57,74,75,84],
18:[53,71,72,73,87,88,89,91,93,94,95,96,97,98,107,115,118,120],
19:[61,62,63,64,65,66,106],
20:[60],
22:[50,51,59,67,68,69,70,78,82,85,86,99,100,101,102,103,104,108,109,110,111,113,116,117,119,121,122,123,124,125,126],
23:[83],
24:[105]
};
const rows=Object.entries(PM).flatMap(([pm,kus])=>kus.map(KU=>({KU,PM:Number(pm),NKU:'Category '+KU,P31:3,PF1:1})));
const ids=rows.map(x=>x.KU);
assert.equal(ids.length,123);
assert.equal(new Set(ids).size,123);
const refs={SKU:rows};
let withRequired=0,buttons=0;
const EXPECTED=(KU,PM)=>{
 const res=[];
 if((KU>=1&&KU<=10)||KU===15||KU===19)res.push(10);
 if(KU===19)res.push(11);
 if([11,12,13].includes(KU))res.push(12);
 if(PM===13)res.push(13);
 if([21,22,23].includes(KU))res.push(17);
 if(KU===60)res.push(19);
 if(PM===3)res.push(25);
 return res.sort((a,b)=>a-b);
};
for(const r of rows){
 const got=rules.maketRequirements(r.KU,refs);
 const actual=(got.required||[]).map(x=>x.number);
 const expected=EXPECTED(r.KU,r.PM);
 assert.deepEqual(Array.from(actual),expected,'Source-controlled requirements mismatch for KU '+r.KU);
 assert(!actual.includes(31)&&!actual.includes(1),'Source flags must never imply M31/M1');
 if(expected.length){withRequired++;buttons+=expected.length;assert.equal(got.status,'partially-confirmed');}
 else {assert.equal(got.required,null);assert.equal(got.status,'unverified');}
 assert.equal(got.complete,false);
}
assert.equal(withRequired,38,'38 existing category codes have category-specific confirmed forms (SKU codes 3 and 8 are absent)');
const road=rules.maketRequirements(31,{SKU:[{KU:31,NKU:'Дорога'}]});
assert.deepEqual(Array.from(road.required||[],r=>r.number),[13],'Compact original SKU must retain PM13 evidence');
assert.deepEqual(Array.from(rules.maketRequirements(43,{SKU:[{KU:43}]}).required||[],r=>r.number),[25]);
assert.equal(rules.maketRequirements(31,{SKU:[{KU:31,PM:0}]}).required,null,'Contradictory full SKU value never overridden');
assert.deepEqual(Array.from(rules.maketRequirements(19,refs).required||[],r=>r.number),[10,11]);
assert.deepEqual(Array.from(rules.maketRequirements(60,refs).required||[],r=>r.number),[19]);
assert.deepEqual(Array.from(rules.maketRequirements(21,refs).required||[],r=>r.number),[17]);
assert.deepEqual(Array.from(rules.maketRequirements(21,refs,{KGLF:21}).required||[],r=>r.number),[17,21]);
assert.deepEqual(Array.from(rules.maketRequirements(31,refs,{Fzona:3}).required||[],r=>r.number),[13,21]);
assert.deepEqual(Array.from(rules.maketRequirements(83,refs,{KGLF:22}).required||[],r=>r.number),[21]);
assert.equal(rules.maketRequirements(83,refs,{KGLF:7,Fzona:7}).required,null,'M21 KGLF7 Fzona7 has further conditional prerequisite 149; do not invent');
assert.equal(rules.maketRequirements(83,refs,{Fzona:0}).required,null);
const quick=fs.readFileSync('solin-quick-card.js','utf8');
assert.match(quick,/if\(!p\?\.code\|\|!requirements\?\.required\?\.length\)/,'Non-mandatory categories must not show a noisy banner');
assert.match(quick,/if\(maket==='10'\)/,'M10 is a main, not extra form');
assert.match(quick,/Fzona:fzona/,'Functional-zone requirements must update on change');
assert.doesNotMatch(quick,/enabled:p\.p31/);
assert.doesNotMatch(quick,/enabled:p\.form1/);
console.log('V62_REQUIRED_MAKETS_OK: '+ids.length+' original SKU categories checked; '+withRequired+' source-confirmed category rules, '+buttons+' buttons, M21 conditional on KGLF/Fzona, no spurious M31/M1');
