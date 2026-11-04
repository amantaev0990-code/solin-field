/* K58/SSHB & Maket10ZAP correction regression from original Solim.mdb.
 * The original 43 K58Ош rows all store M3B=3 / Bon=4 for
 * Проис=7, Возр=5, СВН=2; all tests are read-only. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('solin-card-calculations.js','utf8');
const context={window:{}};vm.runInNewContext(source,context,{filename:'solin-card-calculations.js'});
const calc=context.window.SolinCardCalculations;
const sshb={Происх:7,Возр:5,ВозрН:5,ВозрК:6,Н1б:99,Н1а:99,Н1:5,Н2:4,Н3:3,Н4:1,Н5:0,Н5а:0,Н5б:0};
const refs={SSHB:[sshb]};
const card={POS:213,LESN:2,KV:1,KGLF:27,VD:'1',KU:1,PLV:2,M3Pr:'ИВК',M3B:'3',STUR1:25,STUR:50,
  _children:{Макет10:[{POS:213,LESN:2,KV:1,KGLF:27,VD:'1',IAR:1,POR:'ИВК',PROI:7,POL:0.5,LET:5,PH:2,ZAP:40,KOEF:10}]}};
const snapshot=JSON.stringify(card);
assert.equal(calc.bonitet(card,refs).expected,'4');
assert.equal(calc.bonitet(card,refs).age,5);
assert.equal(calc.standStock(card).expectedPerHa,40);
assert.equal(calc.standStock(card).expectedTotal,80);
const result=calc.corrections(card,refs);
assert.deepEqual(Array.from(result.issues,x=>x.field),['M3B','STUR1','STUR']);
assert.deepEqual(Array.from(result.issues,x=>String(x.expected)),['4','40','80']);
assert.equal(JSON.stringify(card),snapshot,'Calculations must never mutate saved or draft data');
// K59 physical stage has 58 rows, including a V species row with
// height 6, POL approx 0.6, table v6=59 => ZAP=35.
const stockRefs={Szap:[{Obl:150000000,LXZ:8,KUL:'.',p1:'В',v6:59}],SzapCK:[],SDP_Tip:[{KPC:'В',NDR:2}]};
const k59Card={POS:213,LESN:1,KV:6,KGLF:26,VD:'2',M3Pr:'В',KlxrVD:8,KU:2,PLV:2,STUR1:99,STUR:198,
 _children:{Макет10:[{POS:213,LESN:1,KV:6,KGLF:26,VD:'2',IAR:1,POR:'В',POL:0.6000000238418579,KOEF:10,PH:6,ZAP:99}]}};
const k59Snapshot=JSON.stringify(k59Card);
const original=calc.stockPerHectare(k59Card,stockRefs,{KTO:150000000});
assert.equal(original.status,'complete');
assert.equal(original.expected,35);
assert.equal(calc.k59Round(29.5),30,'K59 explicitly rounds 0.5 upward');
assert.equal(calc.accessRound(29.5),30,'Jet Round 29.5 = 30');
assert.equal(calc.accessRound(30.5),30,'Jet Round 30.5 = 30');
const midpoint={...k59Card,_children:{Макет10:[{...k59Card._children.Макет10[0],POL:0.5}]}};
assert.equal(calc.stockPerHectare(midpoint,stockRefs,{KTO:150000000}).expected,30,
 'K59_1 rounds Szap.v6 * 0.5 = 29.5 up to 30');
assert.equal(original.index,0);
const cascaded=calc.corrections(k59Card,stockRefs,{KTO:150000000});
assert.deepEqual(Array.from(cascaded.issues,x=>x.field),['ZAP','STUR1','STUR']);
assert.deepEqual(Array.from(cascaded.issues,x=>x.expected),[35,35,70]);
assert.equal(JSON.stringify(k59Card),k59Snapshot,'K59 corrections must not modify source data');
assert.equal(calc.stockPerHectare(k59Card,stockRefs,null).status,'waiting');
const height7={...k59Card,_children:{Макет10:[{...k59Card._children.Макет10[0],PH:6.5}]}};
assert.equal(calc.stockPerHectare(height7,{...stockRefs,Szap:[{...stockRefs.Szap[0],v7:80}]},{KTO:150000000}).expected,48,
 'K59_1 rounds a weighted 6.5m height up to 7m');
assert.equal(calc.stockPerHectare({...k59Card,KU:21},stockRefs,{KTO:150000000}).status,'not-applicable');
assert.equal(calc.stockPerHectare(k59Card,{Szap:[stockRefs.Szap[0],stockRefs.Szap[0]]},{KTO:150000000}).status,'ambiguous');
assert.equal(calc.stockPerHectare({...k59Card,_children:{Макет10:[...k59Card._children.Макет10,{...k59Card._children.Макет10[0],PH:8}]}},stockRefs,{KTO:150000000}).status,'ambiguous');
const wrongForest={...k59Card,LESN:2};
assert.equal(calc.stockPerHectare(wrongForest,stockRefs,{KTO:150000000}).status,'waiting');

assert.equal(calc.bonitet({...card,KU:21},refs).status,'not-applicable');
assert.equal(calc.standStock({...card,KU:21}).status,'not-applicable');
assert.equal(calc.bonitet({...card,M3Pr:'Б'},refs).expected,'4','Макет10Бон_1 does not filter POR by M3Pr');
assert.equal(calc.bonitet({...card,_children:{Макет10:[...card._children.Макет10,...card._children.Макет10]}},refs).status,'ambiguous');
assert.equal(calc.bonitet({...card,_children:{Макет10:[{...card._children.Макет10[0],LET:199}]}},refs).status,'ambiguous');
assert.equal(calc.bonitet(card,{SSHB:[sshb,ssbh()]}).status,'ambiguous');
function ssbh(){return {...sshb};}
assert.equal(calc.bonitet({...card,_children:{Макет10:[{...card._children.Макет10[0],PH:2.05}]}},refs).status,'ambiguous');
assert.equal(calc.bonitet(card,null).status,'unavailable');
const two={...card,_children:{Макет10:[{...card._children.Макет10[0],ZAP:40},{...card._children.Макет10[0],ZAP:10,PH:3}]}};
assert.equal(calc.standStock(two).status,'ambiguous');
assert.equal(calc.standStock({...card,PLV:0.0125}).expectedTotal,0); // Jet Round: 0.5 -> 0 (even)
assert.equal(calc.standStock({...card,PLV:0.0375}).expectedTotal,2); // Jet Round: 1.5 -> 2 (even)
const diff={...card,LESN:1};
assert.equal(calc.standStock(diff).status,'waiting','A child from a different forestry must never contribute to the stock');
const editor=fs.readFileSync('solin-card-editor.js','utf8');
assert.match(editor,/function recalculateEditedField\(el\)/);
assert.match(editor,/recalculateEditedField\(e\.target\)/);
assert.match(editor,/Было/);
assert.match(editor,/Запас не проверен по К59/);
assert.match(editor,/session\.calcNotices\.findIndex/,'Repeated ZAP correction must update its notice');
assert.match(editor,/if\(changedStock\)/,'Save must also recalculate changed stock');
const workflow=fs.readFileSync('solin-workflow.js','utf8');
assert.doesNotMatch(workflow,/r\.STUR1=m\.ZAP/,'Exit must not copy only the first row');
assert.match(workflow,/SolinCardCalculations\?\.standStock\(r\)/);
assert.match(editor,/Пересчитано · не сохранено/);
assert.match(editor,/const changed=\(row,prior,names\)/);
console.log('K58_AND_STOCK_OK: 43-row historical bonitet fixture, K59 table-backed ZAP and STUR previews, typed correction banner, no data mutation');
