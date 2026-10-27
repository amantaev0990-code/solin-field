'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib');
const sandbox={window:{},D:{quarters:{}}};vm.createContext(sandbox);
for(const file of ['solin-audit-data.js','solin-control-data.js','solin-access-expression.js','solin-control-engine.js','solin-named-controls.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),sandbox);
const {SolinAccessExpression:A,SolinControlEngine:E,solinNamedControls:legacy}=sandbox.window;
const metadata=JSON.parse(fs.readFileSync(path.join(__dirname,'data-meta.json')));
const refs=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'refs-audit.json.gz')))).tables;
const species=new Map(refs.SDP.map(r=>[r.KPC,r]));refs.SDP_Tip=refs.SDP_Tip.map(r=>({...species.get(r.KPC),...r}));
const copy=x=>JSON.parse(JSON.stringify(x));
const blank=form=>Object.fromEntries((metadata.transfSchema[form]||[]).map(k=>[k,null]));
function stand(id,patch={}){return {...blank('Выдел'),POS:213,LESN:2,KV:id,KGLF:27,VD:'1',KU:1,PLV:1,KlxrVD:16,Fzona:1,OZU:0,M3Pr:'Е',_children:{},...patch};}
function child(r,form,patch={}){return {...blank(form),...Object.fromEntries(['POS','LESN','KV','KGLF','VD'].map(k=>[k,r[k]])),...patch};}
function database(records,context={}){return {...copy(metadata),quarters:Object.fromEntries(records.map(r=>[r.KV,{quarterRows:[{POS:r.POS,LESN:r.LESN,KV:r.KV,KGLF:r.KGLF,Klxr:r.KlxrVD,Fzona:r.Fzona,Kpz:5,GodT:2026,Rel:1,...context}],compartments:[r]}]))};}
function settings(...codes){const s=E.defaults();for(const code of codes)s[code].enabled=true;return s;}
function findings(report,code){return new Set(report.findings.filter(x=>x.code===code).map(x=>Number(x.address.KV)));}
let checked=0;
function check(label,fn){fn();checked++;}
(async()=>{
 const SQL=await require('./vendor/sql-wasm.js')({locateFile:p=>path.join(__dirname,'vendor',p)});
 check('NULL logic and numeric shorthand',()=>{assert.equal(A.rule('>0 Or Is Not Null',null,{}),null);assert.equal(A.rule('Is Not Null',null,{}),false);assert.equal(A.rule('(>=0 And <10) Or Is Not Null',-1,{}),true);assert.equal(A.rule('0 Or >4 And <=[RMR]',0,{RMR:5}),true);assert.equal(A.rule('0 Or >4 And <=[RMR]',6,{RMR:5}),false);});
 check('Arithmetic, Int and parent form context',()=>{assert.equal(A.rule('Nz([PTR1])+Nz([PTR3])<=[PLV]',null,{PTR1:2,PTR3:null,PLV:1}),false);assert.equal(A.rule('([PD2]/2)-Int([PD2]/2)=0',null,{PD2:3}),false);assert.equal(A.rule('<=[Forms]![ВыделВ]![PLV]',2,{PLV:99},{PLV:1}),false);assert.equal(A.rule('\\"К\\"','К',{}),true);assert.equal(A.rule('\\"-\\" Or \\"+\\"','x',{}),false);});
 check('Missing context and unknown executable expressions fail closed',()=>{assert.throws(()=>A.rule('<=[Absent]',1,{}),/Нет контекста/);assert.throws(()=>A.rule('=MultiNum([VD])',1,{VD:1}),/Функция/);assert.throws(()=>A.rule('=globalThis.alert(1)',1,{}));assert.throws(()=>A.rule('=IIf(1,1,1/0)',1,{}),/Деление/);assert.equal(A.round(2.5),2);assert.equal(A.round(3.5),4);assert.equal(A.val('12а'),12);});
 check('Original six routes, catalogue and raw code bytes',()=>{const gs=E.groups();assert.equal(gs.length,6);assert.equal(gs.reduce((n,g)=>n+g.openings,0),142);const route=new Set(gs.flatMap(g=>g.codes));assert.equal(route.size,141);assert(!route.has('К22'));assert(!route.has('К143'));assert.equal(sandbox.window.SOLIN_CONTROL_DATA.catalog.length,143);assert.equal(sandbox.window.SOLIN_CONTROL_DATA.catalog.find(c=>c.code==='К28').Kosh,'К 28 ');});
 // Independent implementation previously compared with native Access WHERE.
 const marsh=[],expected04=new Set();let id=0;
 for(const KU of [60,22,null])for(const TB of [null,0,1])for(const TR of [null,0,1])for(const ZP of [null,'','С'])for(const ZPR of [null,0,9,10,20,40,41]){
 const r=stand(++id,{KU});r._children.Макет19=[child(r,'Макет19',{TB,TR,ZP,ZPR})];marsh.push(r);if(legacy.check04(r).some(x=>x.status==='Ошибка'))expected04.add(id);
 }
 let report=await E.run({database:database(marsh),settings:settings('К04'),codes:['К04'],refs,SQL});
 check('567 К04 combinations match the native-verified predecessor',()=>{assert.equal(report.controls[0].status,'executed');assert.deepEqual(findings(report,'К04'),expected04);});
 const forest=[],expected39=new Set();id=0;
 for(const KU of [1,9,10])for(const KGLF of [27,24])for(const OZU of [0,1])for(const Kpz of [4,5,6])for(const Klxr of [15,16,19,20,21])for(const M3Pr of ['Е','С','К','Б'])for(const codes of [[0,0],[96,0],[97,0],[97,96]]){
 const r=stand(++id,{KU,KGLF,OZU,M3Pr,KlxrVD:Klxr});r._testKpz=Kpz;r._children.Макет23=[child(r,'Макет23',{K1:codes[0],K2:codes[1]})];forest.push(r);
 const q={Kpz,Klxr};if(legacy.check39(r,q,refs.SDP_Tip).some(x=>x.status==='Ошибка'))expected39.add(id);
 }
 const db39=database(forest);for(const r of forest)db39.quarters[r.KV].quarterRows[0].Kpz=r._testKpz;
 report=await E.run({database:db39,settings:settings('К39'),codes:['К39'],refs,SQL});
 check('К39 zone, category, species and 96/97 priority matrix',()=>{assert.equal(report.controls[0].status,'executed',report.controls[0].detail);assert.deepEqual(findings(report,'К39'),expected39);});
 const hay=stand(1,{KU:21,KlxrVD:8});hay._children.Макет17=[child(hay,'Макет17',{KU:3,TSP:1,CSP:2,P17:'',PR:0,UR:.5})];
 const db03=database([hay],{Kpz:2,Klxr:8});let s=settings('К03');report=await E.run({database:db03,settings:s,codes:['К03'],refs,SQL});
 check('К03 actual regional hay quality range accepts 0.5',()=>assert.equal(report.findings.length,0,JSON.stringify(report.controls)));
 for(const [label,patch,error]of [['missing quality',{KU:null},true],['missing type',{TSP:0},true],['over regional bound',{UR:.7},true],['CSP=2 with species',{P17:'К'},true],['CSP=4 low coverage',{CSP:4,P17:'К',PR:9},true],['CSP=4 boundary coverage',{CSP:4,P17:'К',PR:10},false]]){
 const db=copy(db03);Object.assign(db.quarters[1].compartments[0]._children.Макет17[0],patch);const r=await E.run({database:db,settings:s,codes:['К03'],refs,SQL});check('К03 '+label,()=>{assert.equal(r.controls[0].status,'executed',r.controls[0].detail);assert.equal(r.findings.length>0,error);});}
 const past=copy(db03);past.quarters[1].compartments[0].KU=23;Object.assign(past.quarters[1].compartments[0]._children.Макет17[0],{CSP:4,P17:'К',PR:5,UR:0});
 report=await E.run({database:past,settings:s,codes:['К03'],refs,SQL});check('К03 KU=23 is outside the 10–40% branch',()=>assert.equal(report.findings.length,0));
 const swamp=stand(1,{KU:60});swamp._children.Макет19=[];const db=database([swamp]),snapshot=JSON.stringify(db),refSnapshot=JSON.stringify(refs);
 report=await E.run({database:db,settings:settings('К04','К114'),codes:['К04','К114'],refs,SQL});
 check('Missing LEFT JOIN row is an error; VBA control stays unverified',()=>{assert.equal(report.findings[0].code,'К04');assert.equal(report.controls.find(c=>c.code==='К114').status,'unverified');assert.equal(report.nativeButtonParity,false);assert.equal(report.preparationApplied,false);});
 check('Control run preserves every input byte and reference row',()=>{assert.equal(JSON.stringify(db),snapshot);assert.equal(JSON.stringify(refs),refSnapshot);});
 report=await E.run({database:db,settings:settings(),codes:['К04'],refs,SQL});check('Disabled Priz never produces a finding',()=>{assert.equal(report.findings.length,0);assert.equal(report.controls[0].status,'disabled');});
 const one=stand(1),foreign=stand(2);foreign.KGLF=24;one._children.Макет23=[child(one,'Макет23',{K1:0,K2:0})];foreign._children.Макет23=[child(foreign,'Макет23',{K1:96})];const mixed=database([one,foreign]);
 report=await E.run({database:mixed,records:[one],settings:settings('К39'),codes:['К39'],refs,SQL});check('Scope and all five child-address fields prevent foreign joins',()=>{assert.equal(report.findings.length,1);assert.equal(report.findings[0].address.KV,1);});
 mixed.quarters[1].quarterRows.unshift({...mixed.quarters[1].quarterRows[0],Fzona:2,Kpz:2});report=await E.run({database:mixed,records:[one],settings:settings('К39'),codes:['К39'],refs,SQL});check('Six-key quarter context ignores another functional zone',()=>assert.equal(report.findings.length,1));
 mixed.quarters[1].quarterRows.push({...mixed.quarters[1].quarterRows[1]});report=await E.run({database:mixed,records:[one],settings:settings('К39'),codes:['К39'],refs,SQL});check('Ambiguous quarter context is unverified, never passed',()=>{assert.equal(report.findings.length,0);assert.equal(report.controls[0].status,'partial');assert(report.controls[0].unverified[0].fields.includes('Kpz'));});
 report=await E.run({database:database([one]),settings:settings('К39'),codes:['К39'],refs:{},SQL});check('Missing dictionaries do not appear as successful checks',()=>assert.equal(report.controls[0].status,'unverified'));
 const lower=stand(1,{M3Pr:'е'});lower._children.Макет23=[child(lower,'Макет23',{K1:0,K2:0})];report=await E.run({database:database([lower]),settings:settings('К39'),codes:['К39'],refs,SQL});
 check('Indexed species joins match Cyrillic codes regardless of case',()=>{assert.equal(report.findings.length,1);assert.equal(lower.M3Pr,'е');});
 const complete=stand(1,{PPVid:'',PPTip:0,ОбПор:'Е'});for(const form of Object.keys(metadata.transfSchema).filter(x=>/^Макет\d+$/.test(x)))complete._children[form]=[child(complete,form)];
 const supported=sandbox.window.SOLIN_CONTROL_DATA.catalog.filter(c=>c.supported).map(c=>c.code);
 report=await E.run({database:database([complete]),settings:settings(...supported),codes:supported,refs,SQL});
 check('Every one of the 26 direct plans compiles with complete source context',()=>{assert.equal(report.controls.length,26);assert.equal(report.controls.filter(x=>x.status==='unverified').length,0,JSON.stringify(report.controls.filter(x=>x.status==='unverified')));});
 const wrongForest=database([swamp]);wrongForest.lesnichestvo[0].LESN=99;report=await E.run({database:wrongForest,settings:settings('К04'),codes:['К04'],refs,SQL});
 check('Original form selection does not leak another forest into К04',()=>assert.equal(report.findings.length,0));
 const orphan=stand(1,{KU:60});orphan._children.Макет19=[child(orphan,'Макет19',{KGLF:24,TB:1,TR:1,ZP:'',ZPR:0})];report=await E.run({database:database([orphan]),settings:settings('К04'),codes:['К04'],refs,SQL});
 check('A child in another KGLF never hides a missing required maket',()=>assert.equal(report.findings.length,1));
 const badArea=stand(1,{PLV:1});badArea._children.Макет15=[child(badArea,'Макет15',{PL15:2})];report=await E.run({database:database([badArea]),settings:settings(),codes:[],refs,SQL});
 check('Field protocol checks parent PLV and supplies an exact edit target',()=>{const issue=report.fields.find(x=>x.form==='Макет15'&&x.field==='PL15');assert.equal(issue.status,'error');assert.equal(issue.row,0);assert.equal(issue.address.KGLF,27);});
 console.log('PASS '+checked+' control-engine scenarios; '+marsh.length+' К04 and '+forest.length+' К39 differential fixtures.');
})().catch(e=>{console.error(e);process.exitCode=1;});
