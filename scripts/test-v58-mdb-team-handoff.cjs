'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const workspace=fs.readFileSync('solin-workspace.js','utf8');
const exportCode=fs.readFileSync('solin-apk-mdb.js','utf8');
const native=fs.readFileSync('native/android/SolinMdbPlugin.java','utf8');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync('solin-transfer-merge.js','utf8'),sandbox);
const merge=sandbox.window.SolinTransferMerge;
assert(!workspace.includes('Скачать всю базу с кварталами, выделами и макетами в JSON'),'JSON handoff button must not be created');
assert.match(workspace,/document\.getElementById\('solin-forest-transfer'\)\?\.remove\(\)/);
assert.match(html,/id="transferForestInput"[^>]*accept="\.mdb,\.accdb/);
assert.match(html,/Экспорт Transfer MDB/);
assert.match(exportCode,/b\.innerHTML=.*Экспорт Transfer MDB/);
assert.match(exportCode,/const result = await plugin\(\)\.export\(\{/);
assert.match(exportCode,/result\?\.verified !== true/);
assert.match(native,/String filename = "Transf_"/);
assert.match(native,/writeVerifiedDocument/);
assert.match(workspace,/id="mergeTransfer" type="button" class="primary"/);
assert.match(workspace,/conflicts\.length&&!window\.confirm/);
function forest(start,end){
 const org={POS:213,LESN:2,GodT:2026};
 const quarters={};
 for(let kv=start;kv<=end;kv++){
  quarters[String(kv)]={quarterRows:[{...org,KV:kv,KGLF:1,Fzona:0,Klxr:3}],
   compartments:[{...org,KV:kv,KGLF:1,VD:'1',PLV:1.2,_children:{'Макет10':[{...org,KV:kv,KGLF:1,VD:'1',IAR:1}]}}]};
 }
 return {org,quarters,extraTables:{},history:[]};
}
const initial=forest(1,35),second=forest(36,70);
const before=JSON.stringify(initial);
const combined=merge.mergeForest(initial,second);
assert.equal(combined.stats.addedQuarters,35);
assert.equal(combined.stats.addedStands,35);
assert.equal(Object.keys(combined.forest.quarters).length,70);
assert.equal(JSON.stringify(initial),before,'Merging must not modify taxator source data');
const conflict=forest(35,36);
conflict.quarters['35'].compartments[0].PLV=7;
assert.throws(()=>merge.mergeForest(initial,conflict),/Объединение отменено/);
const wrong=forest(36,70);wrong.org.GodT=2025;
assert.throws(()=>merge.mergeForest(initial,wrong),/Разные годы/);
console.log('V58_MDB_TEAM_HANDOFF_OK: one real MDB export, MDB chooser, 35+35 quarters, conflicts blocked, source immutable');
