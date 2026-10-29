/* Original SOLI-N visual-review follow-up: exact forestry / quarter row
 * selection and reliable maket navigation. No MDB data is edited here. */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('solin-card-editor.js','utf8');
function launch(quarters){
 const context={window:{},D:{quarters}};
 vm.runInNewContext(source,context,{filename:'solin-card-editor.js'});
 return context.window.SolinCardEditor.resolveQuarter;
}
const q1={quarterRows:[
 {POS:213,LESN:2,KV:1,KGLF:24,Klxr:8,Fzona:null,GodT:2026},
 {POS:213,LESN:2,KV:1,KGLF:27,Klxr:8,Fzona:null,GodT:2026}
]};
const resolve=launch({'1':q1});
assert.equal(resolve({POS:213,LESN:2,KV:1,KGLF:24,KlxrVD:8})?.KGLF,24);
assert.equal(resolve({POS:213,LESN:2,KV:1,KGLF:27,KlxrVD:8})?.KGLF,27);
assert.equal(resolve({POS:214,LESN:2,KV:1,KGLF:24,KlxrVD:8}),null);
assert.equal(resolve({POS:213,LESN:1,KV:1,KGLF:24,KlxrVD:8}),null);
assert.equal(resolve({POS:213,LESN:2,KV:1,KGLF:99,KlxrVD:8}),null);

const two=launch({'8':{quarterRows:[
 {POS:213,LESN:2,KV:8,KGLF:24,Klxr:8,Fzona:1,GodT:2026},
 {POS:213,LESN:2,KV:8,KGLF:24,Klxr:9,Fzona:2,GodT:2025}
]}});
assert.equal(two({POS:213,LESN:2,KV:8,KGLF:24,KlxrVD:9,Fzona:2})?.GodT,2025);
assert.equal(two({POS:213,LESN:2,KV:8,KGLF:24,KlxrVD:8,Fzona:1})?.GodT,2026);
assert.equal(two({POS:213,LESN:2,KV:8,KGLF:24,KlxrVD:7,Fzona:3}),null);
assert.equal(two({POS:213,LESN:2,KV:8,KGLF:24}),null);

const legacy=launch({'9':{meta:{GodT:2026}}});
assert.equal(legacy({POS:213,LESN:2,KV:9,KGLF:24})?.GodT,2026);

assert.match(source,/data-ce-makets/);
assert.match(source,/data-ce-nav-maket/);
assert.match(source,/session\.draft\._children/);
assert.match(source,/activeId!==String\(record\.POS\)/);
console.log('CARD_EDITOR_QUARTER_OK: forest/category/section/zone, ambiguous rows refused, navigator available');
