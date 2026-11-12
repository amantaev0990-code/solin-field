'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const org={POS:213,LESN:2,GodT:2026,GodPU:2015,NOS:'Шетское',NLX:'Лесовладелец'};
const schema={
 'Лесничество':['POS','LESN','GodT','GodPU','NOS','NLX'],
 'Квартал':['POS','LESN','GodT','KV','KGLF','Fzona','Klxr'],
 'Выдел':['POS','LESN','KV','KGLF','VD','PLV','Fzona','M3Pr','M3B','M3TLU'],
 'Макет10':['POS','LESN','KV','KGLF','VD','IAR','POR']
};
const quarters={};
for(let n=1;n<=70;n++){
 const q={...org,KV:n,KGLF:1,Fzona:0,Klxr:3};
 const stand={...q,VD:'1',PLV:1.3,M3Pr:4,M3B:2,M3TLU:9,
  _children:{'Макет10':[{...q,VD:'1',IAR:1,POR:4}]}};
 quarters[String(n)]={meta:q,quarterRows:[q],compartments:[stand]};
}
const D={
 lesnichestvo:[org],quarters,transfSchema:schema,
 _transferExtras:{'КонтрольДоп':[
 {POS:213,LESN:2,KV:9,VD:'1',comment:'A'},
 {POS:213,LESN:2,KV:60,VD:'1',comment:'B'},
 {POS:213,LESN:2,comment:'Forest-wide'}]}
};
const ctx={D,document:{readyState:'loading',addEventListener(){}},window:{},console};
vm.runInNewContext(fs.readFileSync('solin-mdb-bridge.js','utf8'),ctx);
const snapshot=ctx.window.SolinMDBBridge.snapshot;
const all=JSON.parse(JSON.stringify(snapshot()));
assert.equal(all.tables['Квартал'].length,70);
const original=JSON.stringify(D);
const first=JSON.parse(JSON.stringify(snapshot(new Set(Array.from({length:35},(_,i)=>i+1)))));
const second=JSON.parse(JSON.stringify(snapshot(new Set(Array.from({length:35},(_,i)=>i+36)))));
for(const [payload,lo,hi] of [[first,1,35],[second,36,70]]){
 assert.equal(payload.tables['Лесничество'].length,1);
 assert.equal(payload.tables['Квартал'].length,35);
 assert.equal(payload.tables['Выдел'].length,35);
 assert.equal(payload.tables['Макет10'].length,35);
 for(const name of ['Квартал','Выдел','Макет10'])for(const row of payload.tables[name]){
  assert(row.KV>=lo&&row.KV<=hi,name+' leaked KV '+row.KV);
 }
}
assert.deepEqual(first.tables['КонтрольДоп'].map(x=>x.comment),['A','Forest-wide']);
assert.deepEqual(second.tables['КонтрольДоп'].map(x=>x.comment),['B','Forest-wide']);
assert.equal(JSON.stringify(D),original,'Partial export mutated tablet source');
assert.throws(()=>snapshot(new Set()),/Выберите существующие/);
assert.throws(()=>snapshot(new Set([71])),/Выберите существующие/);
// Merge payloads as real Transfer-shaped forest records with child makets.
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync('solin-transfer-merge.js','utf8'),sandbox);
function asForest(payload){
 const result={org,quarters:{},extraTables:{},history:[]};
 for(const row of payload.tables['Квартал'])result.quarters[row.KV]={quarterRows:[row],compartments:[]};
 for(const row of payload.tables['Выдел']){
  const children=payload.tables['Макет10'].filter(m=>m.KV===row.KV&&m.VD===row.VD);
  result.quarters[row.KV].compartments.push({...row,_children:{'Макет10':children}});
 }
 return result;
}
const merged=sandbox.window.SolinTransferMerge.mergeForest(asForest(first),asForest(second));
assert.equal(Object.keys(merged.forest.quarters).length,70);
assert.equal(merged.stats.addedQuarters,35);
assert.equal(merged.stats.addedStands,35);
assert.equal(Object.values(merged.forest.quarters).reduce((n,q)=>n+q.compartments[0]._children.Макет10.length,0),70);
const corrupt=asForest(second);corrupt.quarters[36].compartments[0].PLV=999;
assert.throws(()=>sandbox.window.SolinTransferMerge.mergeForest(asForest(second),corrupt),/Объединение отменено/);
D._transferExtras.КонтрольДоп.push({POS:213,LESN:2,VD:'1',comment:'invalid without KV'});
assert.throws(()=>snapshot(new Set([1,2])),/без номера квартала/);
const exporter=fs.readFileSync('solin-apk-mdb.js','utf8');
assert.match(exporter,/function chooseExportQuarters\(/);
assert.match(exporter,/id="mdbQuarterRange"/);
assert.match(exporter,/await chooseExportQuarters\(\)/);
assert.match(exporter,/snapshot\?\.\(selectedQuarters\)/);
console.log('V59_SELECTED_MDB_OK: only chosen quarters, 35+35, Maket10, extras, no mutation, merge and conflict');
