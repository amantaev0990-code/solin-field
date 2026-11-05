'use strict';
// Private differential replay. Source SQL is read from an existing read-only
// Jackcess inventory and is never embedded into public test fixtures.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),z=require('node:zlib'),assert=require('node:assert/strict');
const [inventoryFile,output]=process.argv.slice(2),root=path.resolve(__dirname,'..');if(!output)throw Error('Usage: PRIVATE_JACKCESS.json PRIVATE_REPORT.json');if(path.resolve(output).startsWith(root+path.sep))throw Error('Keep detailed source evidence outside git');
const inventory=JSON.parse(fs.readFileSync(inventoryFile));assert.equal(inventory.source.sha256,'f49dbcc449294e89632bbc6d6935dc2dcda8fa1732cd9b1f8e9378ca4bc42dcf');assert.equal(inventory.originalUnchanged,true);
const window={};for(const f of ['solin-field-types.js','solin-maket16.js','solin-access-expression.js','solin-access-sql.js','solin-native-control-data.js','solin-native-control-runtime.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),{window});
const M=window.SolinMaket16,N=JSON.parse(JSON.stringify(window.SOLIN_NATIVE_CONTROL_DATA)),refs=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(root,'refs-audit.json.gz')))).tables;
const wanted=['Макет16Созд','Макет16Пересчет','Макет10Пол1ЯрЛ'];for(const name of wanted){const q=inventory.queries.find(q=>q.name===name);assert(q);N.queries[name]=window.SolinAccessSQL.parse(q.sql);}
const kinds={integer:3,long:4,text:10,double:7,float:6};N.schemas.Макет16=Object.fromEntries(Object.entries(window.SolinFieldTypes.tables.Макет16).map(([k,t])=>[k,{type:kinds[t]}]));
for(const name of ['S16VOZ','S16POL','S16KOEF','STL']){const table=inventory.tables.find(t=>t.name===name);N.schemas[name]=Object.fromEntries(table.columns.map(c=>[c.name,{type:{LONG:4,INT:3,DOUBLE:7,FLOAT:6,TEXT:10,BOOLEAN:1}[c.type]||10}]));}
const fields=Object.keys(N.schemas.Макет16),key=r=>JSON.stringify(['POS','LESN','KV','KGLF','VD'].map(k=>r[k])),canon=r=>JSON.stringify(fields.map(k=>typeof r[k]==='string'?r[k].toLocaleUpperCase('ru-RU'):r[k]??null));
(async()=>{
 const SQL=await require(path.join(root,'vendor/sql-wasm.js'))({locateFile:f=>path.join(root,'vendor',f)}),cards=[],trees=[];
 const cedar=refs.STL.filter(r=>String(r.GPor).trim()==='К'),ages=refs.S16VOZ.filter(r=>r.NVoz>80);let sequence=0;
 function add(t,age,coef,pol,extra={}){const i=++sequence,r={POS:213,LESN:2,KV:1,KGLF:27,VD:String(i).padStart(6,'0'),KU:1,KlxrVD:t.Lxz,M3TLU:t.KTL,M3Pr:'К',...extra};const row={POS:r.POS,LESN:r.LESN,KV:r.KV,KGLF:r.KGLF,VD:r.VD,POR:'К',KOEF:coef,LET:age,POL:pol,IAR:1,ZAP:40};r._children={Макет10:[row]};cards.push(r);trees.push(row);return r;}
 for(const t of cedar)for(const a of ages)for(const c of refs.S16KOEF)for(const p of refs.S16POL)add(t,a.NVoz,c.KKoef,p.KPOL);
 const fullDomain=cards.length;
 for(const age of [80,80.5,81,120.999,121,121.001,160.999,161,161.001,500])for(const density of [.299,.29900001,.3,.30099999,.301,.30100001])add(cedar[0],age,3,density);
 for(const KU of [null,0,9,10,11,20])add(cedar[0],100,3,.6,{KU});
 const rt=new window.SolinNativeControlRuntime.Runtime(SQL,N,{'Выдел':cards,'Макет10':trees,'Макет16':[],STL:refs.STL,S16VOZ:refs.S16VOZ,S16POL:refs.S16POL,S16KOEF:refs.S16KOEF},{POS:213,LESN:2});
 let expected;
 try{rt.action('Макет16Созд');expected=rt.read('Макет16');}finally{rt.close();}
 const grouped=new Map();for(const r of expected){const k=key(r);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(canon(r));}
 let matched=0,ambiguous=0,waiting=0,evenTieRows=0;const failures=[];
 for(const r of cards){const before=JSON.stringify(r),actual=M.sourceRows(r,refs,{POS:213,LESN:2});assert.equal(JSON.stringify(r),before);if(actual.status==='waiting'){waiting++;assert.equal((grouped.get(key(r))||[]).length,0);continue;}
  const got=(actual.rows||[]).map(canon).sort(),want=(grouped.get(key(r))||[]).sort();if(JSON.stringify(got)!==JSON.stringify(want)){failures.push({VD:r.VD,actual:got,expected:want,reason:actual.reason});continue;}matched++;if(actual.status==='ambiguous')ambiguous++;
  for(const row of actual.rows||[])if(Number.isInteger(row.Ur16)&&row.Ur16%2===0)evenTieRows++;
 }
 assert.equal(failures.length,0,JSON.stringify(failures.slice(0,3)));
 // Independently execute the original five-field UPDATE, retaining its yield.
 const recalcCards=cards.slice(0,40).map((r,i)=>({...r,M3TLU:cedar[i%cedar.length].KTL})),oldRows=recalcCards.map(r=>({...Object.fromEntries(['POS','LESN','KV','KGLF','VD'].map(k=>[k,r[k]])),Por16:'К',Koef16:9,Voz16:1,Ediz:.9,H16:'old',Ur16:999,Neds:5,Sbor:3}));
 const rt2=new window.SolinNativeControlRuntime.Runtime(SQL,N,{'ВыделВыб':recalcCards,'Макет10Выб':trees.slice(0,40),'Макет10':trees.slice(0,40),'Макет16':oldRows},{POS:213,LESN:2});let updated;
 try{rt2.action('Макет16Пересчет');updated=rt2.read('Макет16');}finally{rt2.close();}
 for(const [i,r]of recalcCards.entries()){const input={...r,_children:{Макет10:[trees[i]],Макет16:[oldRows[i]]}},actual=M.parameterPreview(input,refs);assert.equal(actual.status,'complete');assert.equal(canon({...oldRows[i],...actual.updates[0].values}),canon(updated.find(v=>key(v)===key(r))));assert.equal(updated.find(v=>key(v)===key(r)).Ur16,999);}
 const report={sourceSha256:inventory.source.sha256,sourceQueries:wanted,nativeAccessExecuted:false,scope:'Original saved action SQL on isolated SQLite/WASM vs Field; original Access target coercion and macros are separate',stringCaseIgnoredInSqlComparison:true,normativeDomainCards:fullDomain,boundaryAndNegativeCards:cards.length-fullDomain,projectionCasesMatched:matched,waitingCases:waiting,ambiguousJoinCasesPreserved:ambiguous,originalAppendRows:expected.length,recalcCasesMatched:recalcCards.length,sourceUpdatePreservesUr16:true,failures};
 fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
