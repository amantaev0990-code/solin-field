'use strict';
// Regression for Access TEXT VD and full quarter-row identity during Transfer preview.
// This test deliberately runs without Access, MDB mutations, or a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const w = {addEventListener(){}};
const sandbox = {window:w,D:{transfSchema:{'Макет10':['POS','LESN','KV','KGLF','VD','IAR','POR'], 'Макет23':['POS','LESN','KV','KGLF','VD','K1']}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'solin-workspace.js'),'utf8'),sandbox);
const preview=w.SolinWorkspace.previewTransfer;

const org=(POS,LESN,NOS)=>({POS,LESN,NOS,NLX:'Тестовое учреждение',GodT:2026});
const q=(f,extra={})=>({POS:f.POS,LESN:f.LESN,KV:11,KGLF:27,Klxr:16,Fzona:1,...extra});
const stand=(f,VD,extra={})=>({POS:f.POS,LESN:f.LESN,KV:11,KGLF:27,VD,PLV:1.25,KU:1,...extra});
const child=(r,patch={})=>({POS:r.POS,LESN:r.LESN,KV:r.KV,KGLF:r.KGLF,VD:r.VD,IAR:1,POR:2,...patch});
const base=org(213,2,'Тестовое лесничество');
let passed=0;
function check(name,fn){fn();passed++;console.log('OK '+name);}
function payload(tables){return {format:'SOLI-N Transfer',tables:{'Лесничество':[base],'Квартал':[q(base)],'Выдел':[],...tables}};}
check('TEXT VD retains leading zeroes, different addresses and exact child mapping',()=>{
 const a=stand(base,'001'),b=stand(base,'1');
 const p=payload({'Выдел':[a,b],'Макет10':[child(a),child(b,{IAR:2})]});
 const snapshot=JSON.stringify(p);
 const result=preview(p)[0].quarters['11'].compartments;
 assert.deepEqual([...result.map(r=>r.VD)],['001','1']);
 assert.equal(result[0]._children.Макет10[0].VD,'001');
 assert.equal(result[1]._children.Макет10[0].IAR,2);
 assert.equal(JSON.stringify(p),snapshot,'preview may not edit input');
});
check('Numeric JSON VD converts to text without losing address',()=>{
 const result=preview(payload({'Выдел':[stand(base,1)]}))[0].quarters['11'].compartments;
 assert.equal(result[0].VD,'1');
});
check('Non-numeric TEXT VD remains opaque; no unproven Access restrictions',()=>{
 const result=preview(payload({'Выдел':[stand(base,'12a')]}))[0].quarters['11'].compartments;
 assert.equal(result[0].VD,'12a');
});
check('Empty or missing VD is rejected',()=>{
 for(const VD of ['', ' ',null])assert.throws(()=>preview(payload({'Выдел':[stand(base,VD)]})),/адрес|номер|площад/i);
});
check('Identical five-part stand addresses remain forbidden',()=>{
 assert.throws(()=>preview(payload({'Выдел':[stand(base,'001'),stand(base,'001')]})),/Дублируется полный адрес/);
});
check('Same quarter/KGLF with different Klxr or Fzona stays distinct',()=>{
 const a=q(base),b=q(base,{Klxr:17}),c=q(base,{Fzona:2});
 const result=preview(payload({'Квартал':[a,b,c],'Выдел':[stand(base,'001')]}))[0].quarters['11'];
 assert.equal(result.quarterRows.length,3);
 assert.deepEqual([...result.quarterRows.map(r=>r.Klxr)],[16,17,16]);
 assert.deepEqual([...result.quarterRows.map(r=>r.Fzona)],[1,1,2]);
});
check('Duplicate six-part quarter record is rejected',()=>{
 assert.throws(()=>preview(payload({'Квартал':[q(base),q(base)],'Выдел':[stand(base,'1')]})),/Дублируется квартал/);
});
check('Separately keyed forests cannot mix identical quarter and VD codes',()=>{
 const f2=org(213,1,'Другое лесничество');
 const p=payload({'Лесничество':[base,f2],'Квартал':[q(base),q(f2)],'Выдел':[stand(base,'001'),stand(f2,'001')]});
 const result=preview(p);
 assert.equal(result.length,2);
 assert(result.every(f=>f.quarters['11'].compartments.length===1));
 assert.notEqual(result[0].id,result[1].id);
});
check('Orphan child rows fail rather than attaching to a different VD',()=>{
 const p=payload({'Выдел':[stand(base,'001')],'Макет10':[child(stand(base,'1'))]});
 assert.throws(()=>preview(p),/не связана с единственным выделом/);
});
check('Multiple rows per maket are preserved in input order',()=>{
 const a=stand(base,'001');
 const r=preview(payload({'Выдел':[a],'Макет10':[child(a,{IAR:1}),child(a,{IAR:2})]}))[0].quarters['11'].compartments[0];
 assert.deepEqual([...r._children.Макет10.map(x=>x.IAR)],[1,2]);
});
console.log('PASS '+passed+' Transfer address regression scenarios');