/* 2026-10-29, verified original Solim.mdb snapshot:
 * SKU.P10 group feeds SIAR.Ia (Maket10 IAR RowSource joins PIAP).
 * Values below are copied from physical SKU/SIAR/PIAP rows. No writes to MDB.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('solin-dependent-rules.js','utf8');
const context={window:{}};vm.runInNewContext(source,context,{filename:'solin-dependent-rules.js'});
const rules=context.window.SolinDependentRules;
const refs={
 SKU:[
  {KU:1,NKU:'Насаждение',P10:1,GrMak:1,KLF:11},
  {KU:2,NKU:'Лесные культуры',P10:5,GrMak:3,KLF:11},
  {KU:19,NKU:'Несомкнувшиеся лесные культуры',P10:4,GrMak:9,KLF:12},
  {KU:20,NKU:'Пашня',P10:0,GrMak:15,KLF:21},
  {KU:21,NKU:'Сенокос',P10:2,GrMak:10,KLF:21}
 ],
 SIAR:[
  {Ia:0,KIAR:0,NIAR:null},
  ...[1,2,7,8].map(KIAR=>({Ia:1,KIAR,NIAR:'Ярус '+KIAR})),
  ...[1,2,3,4,5,7,8].map(KIAR=>({Ia:5,KIAR,NIAR:'Ярус '+KIAR})),
  ...[1,3,6,7,8].map(KIAR=>({Ia:4,KIAR,NIAR:'Ярус '+KIAR})),
  ...[7,8].map(KIAR=>({Ia:2,KIAR,NIAR:'Ярус '+KIAR}))
 ],
 PIAP:[1,2,3,4,5,6,7,8].map(KIAR=>({KIAR}))
};
const get=KU=>Array.from(rules.allowedLayers({KU},refs).items,option=>Number(option.value));
assert.deepEqual(get(1),[1,2,7,8]);
assert.deepEqual(get(2),[1,2,3,4,5,7,8]);
assert.deepEqual(get(19),[1,3,6,7,8]);
assert.deepEqual(get(20),[]);
assert.deepEqual(get(21),[7,8]);
assert.equal(rules.landCategory({KU:20},refs).group,0);
assert.equal(rules.allowedLayers({KU:21},refs).categoryName,'Сенокос');
assert.equal(rules.currentIsAllowed('1',rules.options('Макет10','IAR',{IAR:1},{KU:1},null,refs)),true);
assert.equal(rules.currentIsAllowed('3',rules.options('Макет10','IAR',{IAR:3},{KU:1},null,refs)),false);
assert.equal(rules.currentIsAllowed('7',rules.options('Макет10','IAR',{IAR:7},{KU:21},null,refs)),true);
assert.equal(rules.currentIsAllowed('1',rules.options('Макет10','IAR',{IAR:1},{KU:20},null,refs)),false);
assert.equal(rules.allowedLayers({KU:999},refs).status,'unknown');
assert.equal(rules.allowedLayers({KU:1},{SKU:refs.SKU,SIAR:refs.SIAR}).status,'unavailable');
const noPIAP={...refs,PIAP:[{KIAR:1},{KIAR:7}]};
assert.deepEqual(Array.from(rules.allowedLayers({KU:1},noPIAP).items,x=>Number(x.value)),[1,7]);
const editor=fs.readFileSync('solin-card-editor.js','utf8');
const issue=editor.slice(editor.indexOf('function linkedIssues(){'));
assert.ok(issue.indexOf('const changed=')<issue.indexOf('if(changed(base,before'), 'changed() must be initialized before use');
assert.match(editor,/session\.changedMakets\.has\('Макет10'\)/);
assert.match(editor,/ce-category-guidance/);
console.log('SKU_TO_SIAR_OK: 5 categories and joined IAR limits, graceful unknown refs, save validator TDZ guarded');
