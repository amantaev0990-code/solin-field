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
assert.equal(calc.bonitet({...card,KU:21},refs).status,'not-applicable');
assert.equal(calc.standStock({...card,KU:21}).status,'not-applicable');
assert.equal(calc.bonitet({...card,M3Pr:'Б'},refs).status,'waiting');
assert.equal(calc.bonitet({...card,_children:{Макет10:[...card._children.Макет10,...card._children.Макет10]}},refs).status,'ambiguous');
assert.equal(calc.bonitet({...card,_children:{Макет10:[{...card._children.Макет10[0],LET:199}]}},refs).status,'ambiguous');
assert.equal(calc.bonitet(card,{SSHB:[sshb,ssbh()]}).status,'ambiguous');
function ssbh(){return {...sshb};}
assert.equal(calc.bonitet({...card,_children:{Макет10:[{...card._children.Макет10[0],PH:2.05}]}},refs).status,'ambiguous');
assert.equal(calc.bonitet(card,null).status,'unavailable');
const two={...card,_children:{Макет10:[{...card._children.Макет10[0],ZAP:40},{...card._children.Макет10[0],ZAP:10,PH:3}]}};
assert.equal(calc.standStock(two).status,'ambiguous');
assert.equal(calc.standStock({...card,PLV:0.0125}).status,'ambiguous'); // 0.5 tie
const diff={...card,LESN:1};
assert.equal(calc.standStock(diff).expectedTotal,80,'Pure functions do not use global active forestry');
const editor=fs.readFileSync('solin-card-editor.js','utf8');
assert.match(editor,/function recalculateEditedField\(el\)/);
assert.match(editor,/recalculateEditedField\(e\.target\)/);
assert.match(editor,/Введено впервые/);
assert.match(editor,/Пересчитано · не сохранено/);
assert.match(editor,/const changed=\(row,prior,names\)/);
console.log('K58_AND_STOCK_OK: 43-row historical bonitet fixture, stock preview, typed correction banner, no data mutation');
