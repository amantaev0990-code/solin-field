/* V64: regression from screenshot — KOEF=0 plus species, Save, and 5-option search threshold. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=name=>fs.readFileSync(name,'utf8');
const editor=read('solin-card-editor.js');
const android=read('solin-android-selects.js');
const assist=read('solin-card-assist.js');

const start=editor.indexOf('function syncPlusSpeciesForSave(){');
const stop=editor.indexOf('function validate(){',start);
assert(start!==-1&&stop>start,'save sync must exist and precede validation');
assert.match(editor.slice(stop,stop+90),/syncPlusSpeciesForSave\(\)/,'validate must sync before checking');
const fn=editor.slice(start,stop);
const mk=(rowIndex,value,checked=false,disabled=false)=>({
 dataset:{ceRow:String(rowIndex)},value,disabled,
 closest:()=>({querySelector:()=>({checked})})
});
function run(rows,controls){
 const session={draft:{_children:{Макет10:rows}},changedMakets:new Set(),dirty:false};
 const document={querySelectorAll:()=>controls};
 vm.runInNewContext(fn+'\nsyncPlusSpeciesForSave();',{session,document});
 return session;
}
const row1={IAR:1,POR:'ОС',KOEF:10,ZAP:77};
const row2={IAR:1,POR:'Б',KOEF:null,ZAP:0};
const row7={IAR:7,POR:'ОС',KOEF:10,ZAP:5};
let session=run([row1,row2,row7],[mk(1,'',true,true)]);
assert.equal(row2.KOEF,0,'checked plus must persist 0, not blank');
assert.equal(row1.KOEF,10,'regular species unchanged');
assert.equal(row7.KOEF,10,'single trees unchanged');
assert(session.changedMakets.has('Макет10'),'flag M10 to save');
row2.KOEF=null;session=run([row1,row2,row7],[mk(1,'0',false,false)]);
assert.equal(row2.KOEF,0,'immediate typed 0 must persist');
row2.KOEF=null;session=run([row1,row2,row7],[mk(1,'',false,false)]);
assert.equal(row2.KOEF,null,'blank coefficient must NOT become plus species');
assert.equal(session.changedMakets.size,0,'untouched blank must not trigger write');
row2.KOEF=null;session=run([row1,row2,row7],[mk(1,'10',false,false)]);
assert.equal(row2.KOEF,null,'other coefficients use ordinary capture instead of forced zero');

const ctx={window:{}};
vm.runInNewContext(read('solin-access-expression.js'),ctx);
const access=ctx.window.SolinAccessExpression;
assert.equal(access.rule('Is Not Null',0,{KOEF:0}),true,'Access KOEF=0 is NOT NULL');
assert.equal(access.rule('Is Not Null',null,{KOEF:null}),false,'Access KOEF NULL is invalid');
const ctx2={window:{}};
vm.runInNewContext(read('solin-card-calculations.js'),ctx2);
const calc=ctx2.window.SolinCardCalculations;
const card={KU:1,_children:{Макет10:[row1,{...row2,KOEF:0},row7]}};
const audit=calc.compositionAudit(card);
assert.equal(audit.issues.filter(i=>i.field==='KOEF').length,0,'10+0 must pass composition; tier 7 is independent');
assert.match(android,/const searchable=values\.filter\(o=>o\.value!==''\)\.length>=5/);
assert.match(android,/searchable\?'<input id="sap-search"/,'large Android picker shows input');
assert.match(assist,/const searchable=!!list&&list\.filter\(x=>x\.value!==''\)\.length>=5/);
assert.match(assist,/searchable\?'<p class="ce-assist-tip">Найдите/,'large card picker has search');
const threshold=arr=>arr.filter(x=>x.value!=='').length>=5;
assert.equal(threshold([{value:''},...['1','2','3','4'].map(value=>({value}))]),false);
assert.equal(threshold([{value:''},...['1','2','3','4','5'].map(value=>({value}))]),true);
console.log('V64_PLUS_AND_SEARCH_OK: Access 0, 1st layer plus, tier 7, immediate Save, 4/5 choices');
