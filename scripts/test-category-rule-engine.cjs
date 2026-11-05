/* Deterministic 123-category coverage, no Android/Access writes.
 * Tests evidence levels and non-mutating KU-specific POL interpretation.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'solin-category-rules.js'),'utf8'),context,{filename:'solin-category-rules.js'});
const engine=context.window.SolinCategoryRules;
assert.ok(engine && typeof engine.profile==='function','Browser API must publish profile()');
const sku=require(path.join(root,'refs/SKU.json'));
assert.equal(sku.length,123,'Complete original SKU catalogue must be present');
const unique=new Set(sku.map(x=>x.KU));
assert.equal(unique.size,123,'No duplicate KU codes');
for(const entry of sku){
 const before=JSON.stringify(entry);
 const p=engine.profile(entry.KU,{SKU:sku});
 assert.equal(p.code,entry.KU);
 assert.equal(p.name,entry.NKU);
 assert.equal(p.status,'partial','Do not invent P10 from slim catalogue');
 assert.equal(p.hasTreeLayers,null,'Unknown is NOT the same as no layers');
 assert.equal(engine.field(entry.KU,'Макет10','POL',{SKU:sku}).profile.code,entry.KU);
 assert.equal(JSON.stringify(entry),before,'Registry must never rewrite source rows');
}
assert.equal(engine.profile(999,{SKU:sku}).status,'unknown');
assert.equal(engine.profile('',{SKU:sku}).status,'waiting');
assert.equal(engine.profile(1,{}).status,'unavailable');
const full={SKU:[
 {KU:1,NKU:'Насаждение',P10:1,GrMak:1,KLF:11},
 {KU:2,NKU:'Лесные культуры',P10:5,GrMak:3,KLF:11},
 {KU:19,NKU:'Несомкнувшиеся лесные культуры',P10:4,GrMak:9,KLF:12},
 {KU:20,NKU:'Пашня',P10:0,GrMak:15,KLF:21},
 {KU:21,NKU:'Сенокос',P10:2,GrMak:10,KLF:21},
 {KU:60,NKU:'Болото',P10:0,GrMak:7,KLF:32}
]};
assert.equal(engine.profile(1,full).hasTreeLayers,true);
assert.equal(engine.profile(20,full).hasTreeLayers,false);
assert.equal(engine.profile(21,full).maketGroup,10);
assert.equal(engine.profile(21,full).makerFlag,null);
const metadata={SKU:[{KU:19,NKU:'Несомкнувшиеся лесные культуры',P10:4,PM:7,PN:4,P31:3,PF1:9,GrMak:9,KLF:12}]};
const meta=engine.profile(19,metadata);
assert.equal(meta.makerFlag,7);
assert.equal(meta.form1,9);
assert.equal(meta.p31,3);
assert.equal(meta.pn,4);
assert.equal(meta.maketGroup,9);
assert.equal(engine.profile(60,full).forestGroup,32);
assert.equal(engine.field(19,'Макет10','POL',full).label,'Приживаемость, %');
assert.equal(engine.field(19,'Макет10','ZAP',full).kind,'not-applicable');
assert.equal(engine.field(19,'Макет10','ZAP',full).valueForNewRecord,0);
assert.equal(engine.field(1,'Макет10','ZAP',full).kind,'unspecified');
assert.equal(engine.field(1,'Макет10','POL',full).kind,'fullness');
assert.equal(engine.field(2,'Макет10','POL',full).kind,'fullness');
assert.equal(engine.field(20,'Макет10','POL',full).kind,'not-applicable');
assert.equal(engine.field(60,'Макет10','POL',full).kind,'not-applicable');
assert.equal(engine.field(21,'Макет10','POL',full).kind,'unverified','No imagined hayfield POL range');
assert.equal(engine.field(21,'Макет10','POR',full).kind,'unspecified');
const zoned={SKU:[{KU:22,NKU:'Пастбище, выгон',P10:2,Kpoj:3,Pj4:2,Pj16:3}]};
const overridden=engine.zoneAttribute(22,4,zoned);
assert.equal(overridden.status,'source-value');
assert.equal(overridden.source,'SKU.Pj4');
assert.equal(overridden.value,2);
assert.equal(overridden.baseline,3);
assert.equal(overridden.verifiedMeaning,false,'Never invent what Pj code means');
assert.equal(engine.zoneAttribute(22,8,zoned).status,'unavailable');
for(let v=1;v<=100;v++){
 const result=engine.validatePol(19,v,full);
 assert.equal(result.status,v<26?'warning':'ok','Percentage '+v);
}
for(const v of [0,0.5,1.5,101,-1,'word']){
 assert.equal(engine.validatePol(19,v,full).status,'error','Reject invalid percent '+v);
}
for(const v of [0,0.1,0.2,0.7,1]){
 assert.equal(engine.validatePol(1,v,full).status,'ok','Fullness '+v);
}
for(const v of [2,75,100])assert.equal(engine.validatePol(1,v,full).status,'error');
assert.equal(engine.validatePol(21,0.7,full).status,'unverified');
assert.equal(engine.validatePol(21,5,full).status,'warning');
assert.equal(engine.validatePol(20,55,full).status,'warning');
assert.match(engine.guide(19,full),/приживаемость/);
assert.match(engine.guide(20,full),/Ярусы древостоя не предусмотрены/);
assert.match(engine.guide(21,full),/POL: назначение требует проверки/);
const editor=fs.readFileSync(path.join(root,'solin-card-editor.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(editor,/SolinCategoryRules\?\.validatePol/);
assert.match(editor,/rerenderTable\('Макет10'\)/);
assert.match(editor,/SolinCategoryRules\?\.guide/);
assert.match(editor,/Смена категории угодий при заполненных макетах/);
assert.match(editor,/f==='SPS'/,'SPS removed only from visible form');
assert.match(editor,/f==='ZAP'&&!legacyNonzeroStock/);
assert.match(editor,/Для категории 19 запас не указывается/);
assert.match(editor,/category\?\.hasTreeLayers===false&&\!rs\.length/);

const load=html.indexOf('src="solin-category-rules.js');
assert.ok(load>0&&load<html.indexOf('src="solin-dependent-rules.js'),'Rule engine must load before editor');
console.log('CATEGORY_POLICY_OK: 123 SKU codes; known/unknown source states; survival 1–100; 26–100 Access range; KU1/2/20/21/60 controls');
