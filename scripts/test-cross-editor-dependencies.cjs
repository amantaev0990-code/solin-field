/* Shared Access dependency guards: first base choices and cross-Maket species. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('solin-dependent-rules.js','utf8'),context);
const engine=context.window.SolinDependentRules;
const refs={
 SKU:[{KU:2,P10:5,NKU:'Лесные культуры',GrMak:3,KLF:11}],
 SIAR:[{Ia:5,KIAR:1,NIAR:'Первый ярус'},{Ia:5,KIAR:8,NIAR:'Восьмой'}],
 PIAP:[{KIAR:1},{KIAR:8}],
 SDP:[{KPC:'К',NDP:'Кедр'},{KPC:'В',NDP:'Вяз'},{KPC:'Б',NDP:'Берёза'}],
 SLM:[{KM:0,PM2R:0},{KM:10,PM2R:1},{KM:20,PM2R:2}],
 SDP_Tip:[{KPC:'В',DKP2:202500},{KPC:'Б',DKP2:302600}],
 SOV:[{KOV:0,Priz:0}]
};
const stand={
 KU:2,_children:{Макет10:[{IAR:1,POR:'К',KOEF:3,LET:100,POL:.6}],Макет16:[{Por16:'К'}]}
};
assert.equal(engine.treeDependencies(stand,refs).length,0,'Consistent tree rows are valid');
const invalidLayer={...stand,_children:{...stand._children,Макет10:[{IAR:4,POR:'В'}],Макет16:[]}};
const violations=engine.treeDependencies(invalidLayer,refs);
assert.equal(violations.length,1);
assert.equal(violations[0].field,'IAR');
assert.match(violations[0].reason,/SKU.P10/);
const invalidSpecies={...stand,_children:{...stand._children,Макет10:[{IAR:1,POR:'Б'}]}};
const damaged=engine.treeDependencies(invalidSpecies,refs);
assert.equal(damaged.length,1);
assert.equal(damaged[0].form,'Макет16');
assert.equal(damaged[0].field,'Por16');
assert.equal(damaged[0].value,'К');
const fixedTogether={...stand,_children:{Макет10:[{IAR:1,POR:'К',KOEF:6,LET:120,POL:.5}],Макет16:[{Por16:'К'}]}};
assert.equal(engine.treeDependencies(fixedTogether,refs).length,0,'Full card may fix two Makets atomically');
const firstEvent=engine.options('ВыделВ','M2PM1',{},stand,null,refs);
assert.equal(engine.currentIsAllowed(999,firstEvent),false);
assert.equal(engine.currentIsAllowed(10,firstEvent),true);
const source=fs.readFileSync('solin-card-editor.js','utf8');
for(const f of ['M2PM1','PRP1','PLP1'])
 assert(new RegExp(f+':\\[').test(source),'Full card must validate first choice '+f);
assert(source.includes('engine.treeDependencies(base,'),'Full card must use shared cross-Maket audit');
const workflow=fs.readFileSync('solin-workflow.js','utf8');
const cross=workflow.indexOf('window.SolinDependentRules?.validateTransition?.(');
const write=workflow.indexOf('target[m]=list;');
assert(cross>0&&cross<write,'Standalone editor must reject violations BEFORE record mutation');
console.log('CROSS_MAKET_DEPENDENCY_OK IAR by SKU, Maket16 species, atomic full-card fixes, first base codes, pre-save guard');
