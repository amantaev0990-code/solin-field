/* V63: original SKU→SIAR against 35 photographed examples. Read-only tests. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const context={window:{}};
for(const file of ['solin-reference-examples.js','solin-dependent-rules.js','solin-card-calculations.js']){
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
const E=context.window.SolinReferenceExamples;
const rules=context.window.SolinDependentRules;
const C=context.window.SolinCardCalculations;
assert.ok(E&&rules&&C,'Guidance, original dependency rules and stock audit available');
assert.equal(E.examples.length,35,'All 35 printed card examples exist');
assert.equal(new Set(E.examples.map(x=>x.id)).size,35,'Each example is unique');
assert.equal(new Set(E.examples.map(x=>x.ku)).size,22,'22 distinct land categories');
assert.equal(E.forKU(1).length,12,'Forested case count');
assert.equal(E.forKU(9).length,2,'Both cases under canopy');
assert.equal(E.forKU(99999).length,0,'No guessed examples for unknown KU');
assert.equal(E.forKU(null).length,0,'Unknown category is not zero');
const refs=JSON.parse(zlib.gunzipSync(fs.readFileSync('refs-audit.json.gz'))).toString('utf8')).tables;
assert.ok(refs.SKU.length>=120&&refs.SIAR.length>=30);
for(const item of E.examples){
 const entry=refs.SKU.find(x=>String(x.KU)===String(item.ku));
 assert.ok(entry,'Known SKU for printed sample '+item.id);
 const allowed=refs.SIAR.filter(x=>Number(x.Ia)===Number(entry.P10)).map(x=>Number(x.KIAR));
 for(const layer of item.iar)assert.ok(allowed.includes(layer),'Printed sample '+item.id+' invalid layer '+layer);
 const result=rules.allowedLayers({KU:item.ku},refs);
 assert.ok(['complete','partial'].includes(result.status),'Original IAR lookup '+item.id);
}
const names=E.examples.map(x=>x.title);
assert.ok(names.includes('Прогалина с проектируемой посадкой'));
assert.deepEqual(Array.from(E.forKU(9),x=>x.iar.join(',')),['1,4','1,5']);
assert.equal(E.byId(16).ku,19);
assert.equal(E.byId(16).note.includes('POL=30'),true);
assert.equal(E.byId(20).iar[0],7);
assert.equal(E.byId(21).iar[0],8);
assert.equal(E.byId(22).iar.length,0,'Do not create a fake stand layer on a glade');
const card={KU:1,_children:{Макет10:[
 {POS:213,LESN:1,KV:1,KGLF:27,VD:1,IAR:1,POR:'Ос',KOEF:6,ZAP:70},
 {POS:213,LESN:1,KV:1,KGLF:27,VD:1,IAR:1,POR:'Б',KOEF:4,ZAP:0},
 {POS:213,LESN:1,KV:1,KGLF:27,VD:1,IAR:1,POR:'С',KOEF:0,ZAP:0}
]}};
Object.assign(card,{POS:213,LESN:1,KV:1,KGLF:27,VD:1,PLV:1,M3Pr:'Ос'});
const snapshot=JSON.stringify(card);
const composition=C.compositionAudit(card);
assert.ok(!composition.issues.some(issue=>issue.field==='KOEF'), 'Zero plus species is allowed in the numerical composition');
assert.equal(composition.layers[0].coefficientSum,10);
assert.equal(JSON.stringify(card),snapshot,'Inspection never mutates card source');
assert.deepEqual(Array.from(rules.orderMaket10Rows([{IAR:7,id:7},{IAR:1,id:1},{IAR:8,id:8},{IAR:1,id:2}]),x=>x.id),[1,2,7,8]);
const editor=fs.readFileSync('solin-card-editor.js','utf8');
const workflow=fs.readFileSync('solin-workflow.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.match(editor,/ce-reference-examples/,'Study examples visible in navigator only');
assert.match(editor,/data-ce-plus/,'Plus checkbox in main tax card');
assert.match(editor,/orderMaket10Draft\(added\)/,'New species grouped in existing IAR');
assert.match(workflow,/data-wf-plus/,'Plus checkbox in mobile quick composition');
assert.match(workflow,/reorderCards\(\)/,'Quick species grouped by IAR');
assert.match(html,/solin-reference-examples\.js/,'Guidance loaded into app');
assert.match(html,/solin-updates\.js/,'Permanent updater retained');
console.log('V63_REFERENCE_EXAMPLES_OK 35 original scenarios, 22 categories, source-backed IAR, KOEF=0, stable row order');
