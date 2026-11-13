/* V65 regression: KOEF=0 is a per-species value in every layer, but every IAR must sum 10. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const load=name=>fs.readFileSync(name,'utf8');
const context={window:{}};
vm.runInNewContext(load('solin-card-calculations.js'),context,{filename:'solin-card-calculations.js'});
const calc=context.window.SolinCardCalculations;
const row=(iar,koef,por='ОС')=>({IAR:iar,KOEF:koef,POR:por,ZAP:null});
const card=rows=>({KU:1,PLV:1,_children:{Макет10:rows}});
const bad=rows=>calc.compositionAudit(card(rows)).issues.filter(x=>x.status==='bad');
const sum=(rows,iar)=>calc.compositionAudit(card(rows)).layers.find(x=>x.iar===iar)?.coefficientSum;
for(let iar=1;iar<=8;iar++){
 const ten=[row(iar,10),row(iar,0,'Б')];
 assert.equal(bad(ten).length,0,'10+0 must pass IAR '+iar);
 assert.equal(sum(ten,iar),10);
 const mixed=[row(iar,6),row(iar,4,'Б'),row(iar,0,'С')];
 assert.equal(bad(mixed).length,0,'6+4+0 must pass IAR '+iar);
 assert.equal(sum(mixed,iar),10);
 for(const [coef,expected] of [[9,'9'],[11,'11'],[0,'0'],[null,null]]){
  const rows=coef===11?[row(iar,11),row(iar,0,'Б')]:
    coef===null?[row(iar,10),row(iar,null,'Б')]:
    [row(iar,coef),row(iar,0,'Б')];
  const failures=bad(rows);
  assert(failures.some(x=>x.field==='KOEF'&&x.layer===iar),
   'IAR '+iar+' must reject '+expected);
 }
}
assert.equal(bad([row(1,10),row(7,10),row(8,10)]).length,0,
 'Separate IAR 1, 7 and 8 each sum to 10');
assert.equal(bad([row(1,10),row(7,9),row(8,10)])[0].layer,7,
 'Layer 7 cannot borrow 1 point from layer 1');
assert.equal(bad([row(1,10),row(7,10),row(8,9)])[0].layer,8,
 'Layer 8 cannot borrow 1 point from layer 7');
assert.equal(bad([row(1,0)])[0].layer,1,'Plus-only layer with sum=0 must fail');
assert.equal(bad([row(1,10),row(1,0,'Б'),row(7,10),row(7,0,'С')]).length,0,
 'Plus trees accepted in multiple independent layers');
assert.equal(bad([row(1,10),row(1,0.5,'Б')]).length,1,'Fractional KOEF is invalid');
assert.equal(bad([row(1,10),row(1,-1,'Б')]).length,1,'Negative KOEF is invalid');

const editor=load('solin-card-editor.js'),app=load('app.js');
const extract=(start,end)=>{
 const a=editor.indexOf('function '+start+'('),b=editor.indexOf('function '+end+'(',a+1);
 assert(a>=0&&b>a,'extract '+start);
 return editor.slice(a,b);
};
const standNumber=app.slice(app.indexOf('function standNumber('),app.indexOf('function nextStandNumber('));
const lead={IAR:1,POR:'ОС',KOEF:10,ZAP:77};
const plus={IAR:1,POR:'Б',KOEF:0,ZAP:null};
const single={IAR:7,POR:'ОС',KOEF:10,ZAP:5};
const session={draft:{KV:1,VD:'1',KU:1,PLV:1,M3Pr:'ОС',M3TLU:'1',_children:{Макет10:[lead,plus,single]}},
 original:{},quarter:{},originalQuarter:{},baselines:new Map(),isNew:true,changedMakets:new Set(['Макет10'])};
const env={session,window:{SolinCardCalculations:calc},keys:['POS','LESN','KV','KGLF','VD'],
 D:{quarters:{1:{compartments:[]}}},document:{querySelector:()=>null},
 linkedIssues:()=>null,same:(a,b)=>a===b,title:(_,f)=>f,
 solinCore:{validateRow:(form,r)=>form==='Макет10'&&r.ZAP==null?['ZAP: Is Not Null']:[]}};
const script=standNumber+extract('leadingMaket10Row','maket10InputCell')+extract('validate','cleanup')+'validate()';
const validate=()=>vm.runInNewContext(script,env);
assert.doesNotThrow(validate,'Save must allow 10+0 and another independent IAR=7 of 10');
lead.KOEF=9;assert.throws(validate,x=>x.field==='KOEF'&&/Ярус 1.*9/.test(x.message));
lead.KOEF=10;single.KOEF=9;assert.throws(validate,x=>x.field==='KOEF'&&/Ярус 7.*9/.test(x.message));
single.KOEF=10;plus.KOEF=null;assert.throws(validate,x=>x.field==='KOEF'&&/Ярус 1/.test(x.message));
plus.KOEF=0;assert.doesNotThrow(validate,'Restoring KOEF=0 must unblock Save');
session.draft._children.Макет10=[{...row(1,0),ZAP:77}];assert.throws(validate,x=>x.field==='KOEF'&&/0/.test(x.message));
assert.match(load('solin-workflow.js'),/layerCoefficients/,'Quick stand composition checks layer total');
console.log('V65_ALL_IAR_COMPOSITION_OK: 1..8 allow 0 per species, every group sum=10, Save rejects 9/11/blank/0-only');
