/* System-level Access RowSource contracts for every linked selector.
 * Physical Slxr and Szap are read from extracted original Solim.mdb references.
 * No synthetic forest-zone set is used for the regional restrictions. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const data=JSON.parse(zlib.gunzipSync(fs.readFileSync('refs-audit.json.gz')).toString());
const tables=data.tables||data,window={};
vm.runInNewContext(fs.readFileSync('solin-dependent-rules.js','utf8'),{window});
const engine=window.SolinDependentRules;
const values=(form,field,row,card={},org={KTO:350000000},refs=tables)=>Array.from(engine.options(form,field,row,card,org,refs)?.items||[],x=>String(x.value));
assert.deepEqual(values('Квартал','Klxr',{Kpz:2}),['3','4','7']);
assert.deepEqual(values('Квартал','Klxr',{Kpz:3}),['10']);
assert.deepEqual(values('Квартал','Klxr',{Kpz:2},{},{KTO:150000000}),['8','26']);
assert.equal(engine.options('Квартал','Klxr',{Kpz:2},null,{KTO:0},tables).status,'unavailable');
assert.equal(engine.options('Квартал','Klxr',{},null,{KTO:350000000},tables).status,'waiting');
assert.equal(engine.options('Квартал','Klxr',{Kpz:1},null,{KTO:350000000},tables).status,'empty');
assert.equal(engine.currentIsAllowed('8',engine.options('Квартал','Klxr',{Kpz:2},null,{KTO:350000000},tables)),false);
assert.equal(engine.currentIsAllowed('4',engine.options('Квартал','Klxr',{Kpz:2},null,{KTO:350000000},tables)),true);
const trees={_children:{Макет10:[{POR:'В'},{POR:'Б'}]}};
const p16=engine.options('Макет16','Por16',{},trees,{KTO:350000000},tables);
assert.equal(p16.status,'complete');
assert.deepEqual(Array.from(p16.items,x=>x.value),['В','Б']);
assert.equal(engine.currentIsAllowed('С',p16),false);
const category=engine.allowedLayers({KU:2},tables);
assert.equal(category.status,'complete');
assert.equal(category.items.length>0,true);
const p12=engine.options('Макет12','SV',{KTP:84},trees,{KTO:350000000},tables);
assert(p12.items.every(x=>x.value==='0'||tables.SSP.some(r=>String(r.KSP)===x.value&&Number(r.K84)===1)),
 'Access KTP=84 must restrict Maket12 SV degrees');
const plain=engine.options('Макет12','SV',{KTP:1},trees,{KTO:350000000},tables);
assert(plain.items.every(x=>x.value==='0'||tables.SSP.some(r=>String(r.KSP)===x.value&&Number(r.K84)===0)));
const changed=engine.options('ВыделВ','M2PM1',{M2PM1:null},{},{KTO:350000000},tables);
const advanced=engine.options('ВыделВ','M23',{M2PM1:5,M22:7},{},{KTO:350000000},tables);
assert(changed&&advanced);
assert(!advanced.items.some(x=>x.value==='5'||x.value==='7'),'Later interventions cannot repeat former codes');
const main=engine.options('ВыделВ','M3Pr',{},null,{KTO:350000000},tables);
assert.equal(main.items.some(x=>x.value==='КУСТ'),false);
for(const [name,needle] of [
 ['solin-workflow.js','rules.applySelect(el,result'],
 ['solin-card-editor.js','engine.applySelect(el,result'],
 ['solin-field-core.js',"rules.options('Квартал','Klxr'"],
 ['app.js',"rules.options('Квартал','Klxr'"]]){
 const s=fs.readFileSync(name,'utf8');
 assert(s.includes(needle),name+' must share the same source-filtering engine');
}
console.log('SOURCE_DEPENDENT_PICKERS_OK: quarter KTO+Kpz Slxr∩Szap, IAR from SKU, Maket16 species, Maket12 damage, interventions, main species and four editors');
