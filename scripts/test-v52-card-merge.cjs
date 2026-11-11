'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync('solin-transfer-merge.js','utf8'),sandbox);
const merge=sandbox.window.SolinTransferMerge;
assert.equal(typeof merge?.mergeForest,'function','Merger must expose browser API');
const baseline={
  id:'213::1',org:{POS:213,LESN:1,GodT:2026,NLX:'Лесовладелец',NOS:'Лесничество'},
  quarters:{1:{quarterRows:[{POS:213,LESN:1,KV:1,KGLF:1,Fzona:0,Klxr:3,GodT:2026}],
    compartments:[{POS:213,LESN:1,KV:1,KGLF:1,VD:'1',PLV:3,KU:1,
      _children:{Макет10:[{POS:213,LESN:1,KV:1,KGLF:1,VD:'1',IAR:1,POR:'В',PH:10}]}}]}},
  extraTables:{},history:[]
};
const incoming=JSON.parse(JSON.stringify(baseline));
incoming.quarters[1].compartments.push({POS:213,LESN:1,KV:1,KGLF:1,VD:'2',PLV:5,KU:19,
  _children:{Макет10:[{POS:213,LESN:1,KV:1,KGLF:1,VD:'2',IAR:1,POR:'В',PH:null,POL:70,ZAP:0}]}});
incoming.quarters[2]={quarterRows:[{POS:213,LESN:1,KV:2,KGLF:1,Fzona:0,Klxr:3,GodT:2026}],
  compartments:[{POS:213,LESN:1,KV:2,KGLF:1,VD:'1',PLV:7,KU:1,_children:{}}]};
const saved=JSON.stringify(baseline);
const result=merge.mergeForest(baseline,incoming);
assert.equal(JSON.stringify(baseline),saved,'Merger must not change baseline');
assert.equal(result.stats.addedStands,2);
assert.equal(result.stats.addedQuarters,1);
assert.equal(result.stats.identicalStands,1);
assert.equal(result.forest.quarters[1].compartments[1]._children.Макет10[0].PH,null);
assert.equal(result.forest.quarters[2].compartments.length,1);
const conflicting=JSON.parse(JSON.stringify(incoming));
conflicting.quarters[1].compartments[0].PLV=99;
assert.throws(()=>merge.mergeForest(baseline,conflicting),/Объединение отменено/);
assert.equal(JSON.stringify(baseline),saved,'Conflict must never change existing data');
const wrong=JSON.parse(JSON.stringify(incoming));wrong.org.GodT=2025;
assert.throws(()=>merge.mergeForest(baseline,wrong),/Разные годы/);
const forestEditor=fs.readFileSync('solin-card-editor.js','utf8');
assert.match(forestEditor,/Number\(session\.draft\.KU\)===19&&f==='PH'/,'KU19 non-required height');
assert.match(forestEditor,/cell\('M3B',r\.M3B,'base','ВыделВ',\{label:'Бонитет'/,'bonitet input');
assert.ok(forestEditor.indexOf("cell('M3B',r.M3B") < forestEditor.indexOf("maket('2',"),'Bonitet belongs in Maket1');
const quick=fs.readFileSync('solin-quick-card.js','utf8');
assert.match(quick,/const order = \['base','1','10'/);
assert.doesNotMatch(quick,/window\.SolinForestGroups/,'V51 group chooser must be reverted');
assert.match(quick,/SolinCategoryRules\?\.profile/,'Source KU flags');
const forest=fs.readFileSync('solin-v35-features.js','utf8');
assert.doesNotMatch(forest,/window\.SolinForestGroups/);
const css=fs.readFileSync('solin-quick-card.css','utf8');
assert.match(css,/minmax\(135px,180px\)/,'Forest KTL code field must be wider');
assert.match(css,/max-width:none!important;height:auto;min-height:39px/,'Forest type name must not truncate');
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.indexOf('solin-transfer-merge.js')<html.indexOf('solin-workspace.js'));
const exportCode=fs.readFileSync('solin-apk-mdb.js','utf8');
assert.match(exportCode,/expectedM10/);
assert.match(exportCode,/standKeys\.has\(keyStand\(row\)\)/);
const android=fs.readFileSync('native/android/SolinMdbPlugin.java','utf8');
assert.match(android,/new String\[\]\{"Выдел","Макет10"\}/);
console.log('V52 PASS: category19, bonitet Maket1, full forest-name width, source Makets, two-taxator merge, collision safety, Maket10 MDB round-trip checks.');
