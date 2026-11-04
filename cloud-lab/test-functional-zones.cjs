'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),z=require('node:zlib');
const window={};vm.runInNewContext(fs.readFileSync('solin-dependent-rules.js','utf8'),{window});
const E=window.SolinDependentRules,refs=JSON.parse(z.gunzipSync(fs.readFileSync('refs-audit.json.gz'))).tables;
const values=(category,frontend='Solim',scenario='edit')=>Array.from(E.functionalZones({KGLF:category},refs,{frontend,scenario}).items,r=>Number(r.value));
let cases=0;
for(const frontend of ['Solim','Database'])for(const scenario of ['create','edit']){
 assert.deepEqual(values(4,frontend,scenario),scenario==='edit'?[0,12,13,14,15]:[0]);cases++;
 assert.deepEqual(values(5,frontend,scenario),frontend==='Solim'&&scenario==='edit'?[1,2,3,4,12,13,14,15]:[1,2,3,4]);cases++;
 assert.deepEqual(values(9,frontend,scenario),frontend==='Solim'&&scenario==='edit'?[0,1,2,3,4,12,13,14,15]:[0,1,2,3,4]);cases++;
 for(const [category,codes]of [[7,[1,7]],[10,[9,10,11]],[22,[0]],[24,[0]],[26,[0]],[27,[0]]]){assert.deepEqual(values(category,frontend,scenario),codes);cases++;}
}
const zero=E.functionalZones({KGLF:5},refs);assert.equal(E.currentIsAllowed(0,zero),false,'Zero is not universally allowed');
assert.equal(E.functionalZones({},refs).status,'waiting');assert.equal(E.functionalZones({KGLF:5},refs,{frontend:'unknown'}).status,'unavailable');
assert.equal(E.functionalZones({KGLF:5},{SFZ:[]}).status,'unavailable');
const before={KGLF:27,Fzona:12,_children:{}},same=JSON.stringify(before);
const unrelated=E.validateTransition(before,{...before,PLV:2},{},refs);assert(!unrelated.errors.some(e=>e.field==='Fzona'),'Unrelated edit must preserve imported legacy values');
const changed=E.validateTransition(before,{...before,Fzona:3},{},refs);assert(changed.errors.some(e=>e.field==='Fzona'),'An edited invalid zone is rejected');
assert.equal(JSON.stringify(before),same);assert.equal(E.functionalZones({KGLF:5},refs).runtimeVerified,false);
console.log('FZONA_PROFILE_OK '+cases+' exact saved-profile cases, independent zero branch, no KLF join, no unrequested mutation');
