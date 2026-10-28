'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),z=require('zlib'),assert=require('assert/strict');
const s={window:{},setTimeout},read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,f),'utf8'));
vm.createContext(s);
for(const name of ['solin-control-data.js','solin-access-expression.js','solin-control-engine.js','solin-access-sql.js','solin-native-control-data.js','solin-native-control-runtime.js','solin-native-control-engine.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,name),'utf8'),s);
const N=s.window.SOLIN_NATIVE_CONTROL_DATA,E=s.window.SolinControlEngine,fixture=read('tests/native-control-positive.json');
const norms=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(__dirname,'solin-control-norms.json.gz'))));
s.window.SOLIN_AUDIT={validations:[],routes:{Контроль:N.groups.map(g=>({caption:g.macro,actions:g.controlSteps.map(c=>({action:'OpenForm',args:[c.name]}))}))}};
let checks=0;
function check(name,fn){fn();checks++;console.log('OK '+name);}
(async()=>{
 const SQL=await require('./vendor/sql-wasm.js')({locateFile:f=>path.join(__dirname,'vendor',f)});
 const tables={...norms,KUch:[{POS:213,LESN:2,KTO:150000000,GodPU:2015,B:true}],Контроли:N.catalog,ВыделВыб:[{POS:213,LESN:2}],Макет10Выб:fixture.rows};
 const runtime=new s.window.SolinNativeControlRuntime.Runtime(SQL,N,tables,{POS:213,LESN:2,TE:150000000},{date:'2026-10-28'});
 try{
  for(const code of ['К100','К114','К108'])check(code+' matches observed native positive and negative rows',()=>assert.deepEqual([...runtime.query(code).map(r=>r.KV)].sort(),fixture.expected[code].sort()));
  check('Stateful native numbering, null species, coefficient order and opaque VD',()=>{const names=['KV','VD','POR','KOEF','Lev_1','Lev_2','Lev_3'];const values=runtime.query('К114_а').map(r=>Object.fromEntries(names.map(k=>[k,r[k]])));assert.equal(JSON.stringify(values),JSON.stringify(fixture.nativeNumbering));});
 }finally{runtime.close();}
 const r=new s.window.SolinNativeControlRuntime.Runtime(SQL,N,{...norms,ВыделВыб:[{POS:213,LESN:2,KTO:150000000,KGLF:24,Klxr:1,VD:'1',KV:1,KU:1,PP:0,OZU:0,M3B:'1',M3Pr:'Б',NDR:2}]},{POS:213,LESN:2,TE:150000000});
 try{check('Native NDR binding when prepared and joined values deliberately disagree',()=>assert.equal(r.query('Выдел_КГЛФ2')[0].KGLF2427,fixture.binding.KGLF2427));}finally{r.close();}
 const meta=read('data-meta.json'),base=Object.fromEntries(meta.transfSchema.Выдел.map(k=>[k,null]));
 const record={...base,POS:213,LESN:2,KV:1,KGLF:27,VD:'001',Fzona:1,KlxrVD:8,KU:60,PLV:1,PP:0,ARE:0,OZU:0,M3Pr:'',M3TLU:'',AKL:0,AGR:0,AGR1:0,_children:{Макет27:[{POS:213,LESN:2,KV:1,KGLF:27,VD:'001',KU:0,CH:0,KS:0,GOD:0}]}};
 const database={...meta,quarters:{1:{quarterRows:[{POS:213,LESN:2,KV:1,KGLF:27,Klxr:8,Fzona:1,Kpz:2,GodT:2026}],compartments:[record]}}};
 const before=JSON.stringify(database);s.D=database;s.window.solinCore={checkpoint(){}};
 const report=await E.run({database,SQL,norms,codes:['К04'],date:'2026-10-28'});
 check('Preparation is isolated until explicitly applied',()=>{assert.equal(JSON.stringify(database),before);assert.equal(report.preparation.complete,true,report.runtimeError);assert.equal(report.preparation.incompleteInputs.length,0);assert(report.preparation.updates.some(r=>r.field==='M3B'&&r.previous===null&&r.next===''));assert.equal(report.preparation.deleted.length,1);});
 s.window.solinCore.checkpoint=()=>{throw Error('Storage failure');};
 check('Storage failure rolls back all preparation changes',()=>{assert.throws(()=>E.applyPreparation(report),/Storage failure/);assert.equal(JSON.stringify(database),before);});
 s.window.solinCore.checkpoint=()=>{};
 check('Apply and undo preserve source data',()=>{E.applyPreparation(report);assert.equal(database.quarters[1].compartments[0]._children.Макет27.length,0);E.undoPreparation(report);assert.equal(JSON.stringify(database),before);});
 record._gps={at:1};check('Stale reports cannot change edited data',()=>assert.throws(()=>E.applyPreparation(report),/изменились/));delete record._gps;
 const draft=await E.run({database,SQL,norms,codes:['К04'],draft:true});check('A draft never offers destructive preparation',()=>assert.throws(()=>E.applyPreparation(draft),/черновик/));
 delete record.OZU;const incomplete=await E.run({database,SQL,norms,codes:['К04']});
 check('Missing source fields are not passed or destructively prepared',()=>{assert.equal(incomplete.controls.find(c=>c.code==='К04').status,'partial');assert.throws(()=>E.applyPreparation(incomplete),/исходных данных/);});
 record.OZU=0;record.PLV=1e40;const overflow=await E.run({database,SQL,norms,codes:['К04']});check('Single overflow cannot produce a passed result or write preparation',()=>{assert(overflow.runtimeError);assert.equal(overflow.controls.find(c=>c.code==='К04').status,'unverified');assert.throws(()=>E.applyPreparation(overflow),/не завершена/);assert.equal(record.PLV,1e40);});
 console.log('PASS '+checks+' native control regression scenarios');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
