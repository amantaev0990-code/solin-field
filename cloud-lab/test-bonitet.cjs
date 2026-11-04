'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),window={};
for(const f of ['solin-card-calculations.js','solin-access-expression.js','solin-access-sql.js','solin-native-control-data.js','solin-native-control-runtime.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window});
const C=window.SolinCardCalculations,N=window.SOLIN_NATIVE_CONTROL_DATA,refs=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'refs-audit.json.gz')))).tables;
const hashes={'Макет10Бон_1':'38fe6ff18377ac0e933d6f40860a00e659d5ec1bdfec0ce481571aca2a563b0b','Макет10Бон_2':'1b3539a06f66e8139de0779244c4d23351cc4aa5f59c3f62fd38af3cb3433ea2','Макет10Бон':'727709e48ee1e70f0b6703753ea5bfd5ad959d6187550a8d600813f947822518','Макет10Ярмин':'8b37f8749d3616d817bfd1c2ae6e06134445c6f32c05a14ae18b66ec078fec1b'};
for(const [name,hash]of Object.entries(hashes))assert.equal(N.queries[name].sourceHash,hash,'Reverify changed source: '+name);
function card(origin,age,height,species='Б',year=2026){
 const r={POS:213,LESN:2,KV:1,KGLF:27,VD:'1',VDCH:1,KU:1,M3Pr:species,M3B:'3',GodT1:year};
 r._children={Макет10:[{...r,M3Pr10:species,KU10:1,IAR:1,POR:'ОС',POL:.5,ZAP:40,LET:age,PH:height,PROI:origin}]};return r;
}
(async()=>{
 const SQL=await require(path.join(root,'vendor/sql-wasm.js'))({locateFile:f=>path.join(root,'vendor',f)}),cases=[];
 function check(r,reason,allowUnverified=false){
  const before=JSON.stringify(r),rt=new window.SolinNativeControlRuntime.Runtime(SQL,N,{'ВыделВыб':[r],'Макет10Выб':r._children.Макет10,SSHB:refs.SSHB},{POS:213,LESN:2});
  try{
   const original=rt.query('Макет10Бон'),actual=C.bonitet(r,refs);assert.equal(JSON.stringify(r),before,'A preview must not mutate the card');
   const values=[...new Set(original.map(row=>row.Bon))];
   if(allowUnverified){assert.notEqual(actual.status,'complete');cases.push({reason,status:'unverified',originalValues:values});return;}
   if(values.length===1&&values[0]){assert.equal(actual.status,'complete',reason+': '+actual.reason);assert.equal(actual.expected,values[0],reason);}
   else assert.notEqual(actual.status,'complete',reason+': no nonempty, unique source result');
   cases.push({reason,status:'matched',originalValues:values,fieldStatus:actual.status});
  }finally{rt.close();}
 }
 // Every recovered age/origin row, not a hand-picked species example.
 for(const scale of refs.SSHB){const age=Math.max(1,(Number(scale.ВозрН)+Number(scale.ВозрК))/2);check(card(Number(scale.Происх),age,4.4),'SSHB origin/age '+scale.Происх+'/'+scale.Возр);}
 const origins=[...new Set(refs.SSHB.map(r=>Number(r.Происх)))];
 for(const origin of origins){const s=refs.SSHB.find(r=>Number(r.Происх)===origin),age=Math.max(1,Number(s.ВозрН));
  for(const year of [2016,2017,2026])for(const h of [.6,1,4,5])check(card(origin,age,h,'Б',year),'Year/height '+[origin,year,h].join('/'));
  for(const species of ['БРК','БОЯ','КЛН','РК','Ч','ОБ','СИР'])for(const h of [.6,4.4])check(card(origin,age,h,species),'Two-stage origin '+[species,origin,age,h].join('/'));
 }
 const dry=card(7,5,2);dry._children.Макет10[0].ZAP=0;check(dry,'No positive stock must not bypass Макет10Ярмин');
 const zero=card(7,5,2);zero._children.Макет10[0].POL=0;check(zero,'Zero fullness is excluded by the source');
 const nullStock=card(7,5,2);nullStock._children.Макет10[0].ZAP=null;check(nullStock,'NULL ZAP is not positive stock');
 const wrongAddress=card(7,5,2);wrongAddress._children.Макет10[0].LESN=3;check(wrongAddress,'Foreign child address cannot calculate bonitet');
 check(card(7,5,2.05),'Unverified Jet midpoint',true);
 const unknownYear=card(7,5,.6);delete unknownYear.GodT1;check(unknownYear,'Missing year for low-height branch',true);
 const mixed=card(7,5,2);mixed._children.Макет10.push({...mixed._children.Макет10[0],POR:'С',PH:7,PROI:1});check(mixed,'Several source measurement groups',true);
 assert.equal(C.bonitet(card(7,5,.6),refs,{GodT:2016}).status,'ambiguous','Conflicting year context must be reported');
 assert.equal(C.bonitet({...unknownYear},refs,{GodT:2016}).height,1,'Use quarter-derived year when available');
 const mismatch=card(7,5,2);assert.equal(C.bonitet(mismatch,refs).expected,'4','Source does not join POR to M3Pr');
 const report={scope:'Full saved Макет10Ярмин → Макет10Бон_1 → Макет10Бон_2 → Макет10Бон on isolated SQLite/WASM',nativeAccessExecuted:false,sourceHashes:hashes,cases,matched:cases.filter(c=>c.status==='matched').length,unverified:cases.filter(c=>c.status==='unverified').length};
 if(process.env.CLOUD_LAB_BONITET_OUTPUT){const out=path.resolve(process.env.CLOUD_LAB_BONITET_OUTPUT);if(out.startsWith(root+path.sep))throw Error('Keep detailed source cases outside git');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));}
 console.log('BONITET_SOURCE_OK '+report.matched+' matched cases; '+report.unverified+' explicitly unverified guards; current native Access execution not claimed');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
