/* Regression: Maket 10 keeps several species of one IAR adjacent.
 * Pure helper uses the ORIGINAL row objects and never discards MDB fields. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'solin-dependent-rules.js'),'utf8');
const ctx={window:{}};
vm.runInNewContext(source,ctx,{filename:'solin-dependent-rules.js'});
const order=ctx.window.SolinDependentRules?.orderMaket10Rows;
assert.equal(typeof order,'function','Maket10 order helper is exported');
const rows=[
 {IAR:7,POR:'К',KOEF:10,ZAP:5,id:'7'},
 {IAR:2,POR:'С',KOEF:7,ZAP:10,id:'2a'},
 {IAR:1,POR:'Ос',KOEF:6,ZAP:50,id:'1a'},
 {IAR:8,POR:'С',KOEF:10,ZAP:5,id:'8'},
 {IAR:1,POR:'Б',KOEF:4,ZAP:0,id:'1b'},
 {IAR:2,POR:'Б',KOEF:3,ZAP:0,id:'2b'},
 {IAR:null,POR:'',KOEF:null,id:'blank'}
];
const copy=JSON.stringify(rows);
const ordered=order(rows);
assert.equal(ordered.map(x=>x.id).join(','),'1a,1b,2a,2b,7,8,blank');
assert.equal(JSON.stringify(rows),copy,'input rows unchanged');
assert.strictEqual(ordered[0],rows[2],'original species row object preserved');
assert.strictEqual(ordered[1],rows[4],'companion species stays in same tier');
assert.equal(ordered[0].ZAP,50,'first species stock preserved');
assert.equal(ordered[1].ZAP,0,'second species stock preserved');
assert.equal(ordered[0].KOEF+ordered[1].KOEF,10,'composition preserved');
const added={IAR:1,POR:'Т',KOEF:null,ZAP:null,id:'added'};
const newRows=order([...rows,added]);
assert.equal(newRows.map(x=>x.id).join(','),'1a,1b,added,2a,2b,7,8,blank','new first tier after existing first tier');
assert.strictEqual(newRows[2],added,'new row identity retained');
const changed=order(rows.map(x=>x.id==='2a'?{...x,IAR:1}:x));
assert.equal(changed.map(x=>x.id).join(','),'2a,1a,1b,2b,7,8,blank','changing tier repositions row stably');
assert.equal(order([{IAR:1,POR:'Ос'},{IAR:1,POR:'Б'}]).length,2);
assert.equal(order([]).length,0);
const editor=fs.readFileSync(path.join(root,'solin-card-editor.js'),'utf8');
const workflow=fs.readFileSync(path.join(root,'solin-workflow.js'),'utf8');
assert.match(editor,/orderMaket10Draft\(added\)/,'add action sorts draft');
assert.match(editor,/initialMaket10Iar\(preferredIar\)/,'add action inherits currently selected tier');
assert.match(workflow,/window\.SolinDependentRules\.orderMaket10Rows\(rows\)/,'overview and edit indices sorted');
console.log('Maket10 tier-order regression: OK');
