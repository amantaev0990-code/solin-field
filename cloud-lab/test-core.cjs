'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),window={};
for(const f of ['solin-card-calculations.js','solin-access-expression.js','solin-access-sql.js','solin-native-control-data.js','solin-native-control-runtime.js'])
 vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window});
const C=window.SolinCardCalculations,org={POS:213,LESN:2,KTO:150000000};
const card={POS:213,LESN:2,KV:1,KGLF:27,VD:'001',KU:1,PLV:2,M3Pr:'Б',M3B:'3',GodT1:2026,STUR1:777,STUR:1554,
 _children:{Макет10:[{IAR:1,POR:'Б',KOEF:10,PH:2,POL:.5,ZAP:20}]}};
const refs={Szap:[{Obl:150000000,LXZ:8,KUL:'.',p1:'Б',v1:60,v2:80,v3:100,v4:120}],SzapCK:[],SDP_Tip:[{KPC:'Б',NDR:2}]};card.KlxrVD=8;
let checks=0;const check=(name,fn)=>{fn();checks++;};const copy=x=>JSON.parse(JSON.stringify(x));
check('No speculative zeroing of companion ZAP or NULL',()=>{
 const x=copy(card);x._children.Макет10[0].KOEF=6;x._children.Макет10.push({IAR:1,POR:'ОС',KOEF:4,PH:2,POL:0,ZAP:3120});
 const before=JSON.stringify(x),r=C.corrections(x,{Szap:[],SSHB:[]},org);
 assert(!r.issues.some(i=>['ZAP','STUR1','STUR'].includes(i.field)));assert(r.unknown.some(i=>i.kind==='companion-conflict'));assert.equal(JSON.stringify(x),before);
 x._children.Макет10[1].ZAP=null;assert.equal(C.companionStockIssues(x).length,0);
});
check('Incomplete composition retains all existing totals',()=>{
 const x=copy(card);x._children.Макет10[0].KOEF=6;x._children.Макет10.push({IAR:1,POR:'ОС',KOEF:3,PH:2,POL:0,ZAP:null});
 const r=C.corrections(x,refs,org);assert(!r.issues.some(i=>['STUR1','STUR'].includes(i.field)));assert.equal(x.STUR1,777);assert.equal(r.standStock.status,'waiting');
});
check('Original GROUP BY ambiguity never authorizes a scalar UPDATE',()=>{
 const x=copy(card);x._children.Макет10.push({...x._children.Макет10[0],IAR:2,ZAP:10});
 assert.equal(C.sourceStandStock(x).status,'ambiguous');assert.equal(C.corrections(x,{Szap:[]}).standStockVerified,false);
});
check('Drywood and single trees stay separate from the living subtotal',()=>{
 const x=copy(card);x.M4SS=8;x._children.Макет10.push({IAR:7,POR:'Б',ZAP:5},{IAR:8,POR:'Б',ZAP:9});
 assert.equal(C.standStock(x).expectedPerHa,20);assert.equal(C.stockBreakdown(x).singleTreesPerHa,5);assert.equal(C.stockBreakdown(x).freshDeadwoodPerHa,9);
 assert.equal(C.sourceStandStock(x).status,'ambiguous');assert(!C.corrections(x,{Szap:[]}).issues.some(i=>i.field==='STUR'));
});
check('Wrong district, KGLF and year contexts cannot calculate normative corrections',()=>{
 assert.equal(C.stockPerHectare(card,refs,{...org,LESN:3}).status,'ambiguous');
 assert.equal(C.stockPerHectare(card,refs,org,{KGLF:24}).status,'ambiguous');
 assert.equal(C.stockPerHectare(card,refs,org,{GodT:2015}).status,'ambiguous');
});
check('Incomplete norm tables cannot be labeled verified',()=>{
 assert.equal(C.stockPerHectare(card,{...refs,SzapCK:undefined},org).status,'unavailable');
 assert.equal(C.stockPerHectare(card,{...refs,SDP_Tip:[]},org).status,'unavailable');
});
check('Exact rounding comparisons preserve both sides of a binary midpoint',()=>{
 assert.equal(C.k59Round(2.5-5e-10),2);assert.equal(C.k59Round(2.5),3);assert.equal(C.k59Round(2.5+5e-10),3);
 assert.equal(C.accessRound(2.5-5e-10),2);assert.equal(C.accessRound(2.5),2);assert.equal(C.accessRound(2.5+5e-10),3);
});
(async()=>{
 const SQL=await require(path.join(root,'vendor/sql-wasm.js'))({locateFile:f=>path.join(root,'vendor',f)}),N=window.SOLIN_NATIVE_CONTROL_DATA;
 assert.equal(N.queries['К59_1'].sourceHash,'f7edc8160d41c74f4acbb4ac41a9fbcff4747570eaee81b140ef1c37249ee066','Reverify the source oracle after saved SQL changes');
 function oracle(x,r,ndr){
  const row=x._children.Макет10[0],s={KlxrVD:8,KTO:150000000,POS:213,LESN:2,KV:1,KGLF:27,VD:'001',VDCH:1,PLV10:2,KU10:1,IAR:1,POR:row.POR,POL:row.POL,ZAP:row.ZAP,GodT:x.GodT1,Bon2:x.M3B,NDR:ndr,СВН1:x._children.Макет10.reduce((v,a)=>v+a.KOEF*a.PH,0)/10,Kosh:'К59',Tosh:'',Prim:''};
  const rt=new window.SolinNativeControlRuntime.Runtime(SQL,N,{'К59_2':[s],SZap:r.Szap,SzapCK:r.SzapCK},{POS:213,LESN:2,TE:150000000});
  try{rt.action('К59_1');return rt.query('К5900')[0]?.ZZR??null;}finally{rt.close();}
 }
 for(const ndr of [2,4])for(const year of [2016,2017,2026])for(const ck of [null,0,37.5]){
  const x=copy(card);x.GodT1=year;const r=copy(refs);r.SDP_Tip[0].NDR=ndr;if(ck!==null)r.SzapCK=[{Obl:150000000,p1:'Б',Boni:'3',v20c:ck}];
  check('K59 saved-query differential '+[ndr,year,ck].join('/'),()=>{
   const expected=oracle(x,r,ndr),actual=C.stockPerHectare(x,r,org);
   if(expected===null)assert.notEqual(actual.status,'complete');else{assert.equal(actual.status,'complete',actual.reason);assert.equal(actual.expected,expected);}
  });
 }
 for(const [a,b]of [['ОС','Б'],['С','ЕЛ'],['В','ЛХ'],['Т','Л'],['К','ЯБД']])for(const coef of [1,3,6,9]){
  const x=copy(card);x.M3Pr=a;x._children.Макет10=[{IAR:1,POR:a,KOEF:coef,PH:2,POL:.5,ZAP:20},{IAR:1,POR:b,KOEF:10-coef,PH:3,POL:0,ZAP:null}];
  // The lead is selected by composition. Put the carrier on that row.
  const lead=coef>=5?0:1;x._children.Макет10[0].ZAP=lead===0?20:null;x._children.Макет10[1].ZAP=lead===1?20:null;
  check('Generic mixed-layer arithmetic '+a+'/'+b+'/'+coef,()=>{assert.equal(C.standStock(x).expectedPerHa,20);assert.equal(C.standStock(x).expectedTotal,40);});
 }
 console.log('CLOUD_LAB_CORE_OK '+checks+' source differential, preservation, negative and composition cases; native Access execution is not claimed');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
