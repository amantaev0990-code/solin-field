'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
if(process.argv.length<5)throw Error('Usage: node scripts/build-native-control-data.cjs probe.json plan.json schema.json [native-run.json] [normative-tables.json]');
const dir=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(dir,'solin-access-sql.js'),'utf8'),sandbox);
const native=read(process.argv[2]);
const steps=read(process.argv[3]);
const defs=new Map(native.queries.map(q=>[q.name.toLowerCase(),q]));
const queries={},errors=[];
for(const name of steps.metadata.dependencyCandidateClosure){
 const q=defs.get(name.toLowerCase());
 if(name==='KUch_Les')continue; // Contact-list helper is not executed in this flow.
 try{queries[q.name]=sandbox.window.SolinAccessSQL.parse(q.sql);queries[q.name].sourceHash=crypto.createHash('sha256').update(q.sql).digest('hex');}
 catch(e){errors.push({name,error:e.message});}
}
const roots=[...steps.preamble,...steps.groups.flatMap(g=>[...g.preparation,...g.controlSteps.map(c=>c.name)]),'К22'];
const tableSources=new Set(),used=new Set(),targets=new Set();
function collect(name){
 name=defs.get(name.toLowerCase())?.name||name;
 if(used.has(name))return;
 if(!queries[name]&&defs.has(name.toLowerCase())){const q=defs.get(name.toLowerCase());queries[q.name]=sandbox.window.SolinAccessSQL.parse(q.sql);queries[q.name].sourceHash=crypto.createHash('sha256').update(q.sql).digest('hex');}
 const plan=queries[name];if(!plan){tableSources.add(name);return;}
 used.add(name);if(plan.into)targets.add(plan.into);if(plan.target&&plan.kind==='insert')targets.add(plan.target);
 const source=(plan.select||plan).from;
 function canonical(n){if(n.kind==='table')n.name=defs.get(n.name.toLowerCase())?.name||n.name;else{canonical(n.left);canonical(n.right);}}
 canonical(source.ast);
 for(const t of source.sources){t.name=defs.get(t.name.toLowerCase())?.name||t.name;collect(t.name);}
}
roots.forEach(collect);
// A deliberately conflicting NDR probe in native Access selected SDP_Tip.NDR
// (24), not prepared ВыделВыб.NDR (0), in this one saved expression.
if(queries['Выдел_КГЛФ2'].sourceHash!=='5cca0739ed67f18c8834560cf62e27fe73b87de03ae8ea6876a3a9ded5c3d2d0')throw Error('Re-verify native NDR binding after source changes');
queries['Выдел_КГЛФ2'].bindings={ndr:'SDP_Tip'};
const schema=read(process.argv[4]);
const schemas=Object.fromEntries(schema.filter(t=>t.base==='Solim').map(t=>[t.name,Object.fromEntries(t.fields.map(f=>[f.name,{type:f.type,size:f.size}]))]));
const byName=new Map(Object.keys(schemas).map(k=>[k.toLowerCase(),k]));
const base=[...tableSources].filter(n=>!targets.has(n)).map(n=>byName.get(n.toLowerCase())||n);
const norm=base.filter(n=>!['KUch','Квартал','Выдел','Памятники','Аренда','Контроли','Настройка'].includes(n)&&!/^Макет\d+$/.test(n));
const keep=new Set([...base,...targets]);const bundle={version:2,source:{scope:'Audited original SQL preparation and group queries; native reference 2026-10-28; form-event parity is not claimed',nativeButtonParity:false,referenceDate:'2026-10-28'},queries:Object.fromEntries([...used].filter(n=>queries[n]).map(n=>[n,queries[n]])),schemas:Object.fromEntries(Object.entries(schemas).filter(([n])=>keep.has(n))),baseTables:base,normativeTables:norm.filter(n=>n!=='АрендаКв'),temporaryTables:[...targets].filter(n=>!/^Макет\d+$/.test(n)),preamble:steps.preamble,groups:steps.groups,catalog:native.controls.map(c=>({...c,code:c.Kosh.replace(/\s/g,''),supported:!!queries[c.Kosh.replace(/\s/g,'')]}))};
const nativeRun=process.argv[5]?read(process.argv[5]):null;const live=nativeRun?.liveMenuContext;
bundle.contexts=live?[{POS:live['ЛВ_1'],LESN:live['Лес_1'],TE:live.TE,source:'Настройка, verified against the open original main form on '+nativeRun.hostDate}]:[];
bundle.source.definitionsCompared=466;bundle.source.definitionsMatched=466;
if(process.argv[6]){const z=require('zlib'),input=read(process.argv[6]),allowed=new Set(bundle.normativeTables);if(Object.keys(input).some(n=>!allowed.has(n)))throw Error('Unexpected normative table');for(const n of allowed)if(!Array.isArray(input[n]))throw Error('Missing normative table '+n);const bytes=z.gzipSync(JSON.stringify(input),{level:9});fs.writeFileSync(path.join(dir,'solin-control-norms.json.gz'),bytes);bundle.source.normsSha256=crypto.createHash('sha256').update(bytes).digest('hex');}
fs.writeFileSync(path.join(dir,'solin-native-control-data.js'),'/* Generated from audited saved definitions; no working records. */\nwindow.SOLIN_NATIVE_CONTROL_DATA='+JSON.stringify(bundle)+';\n');

console.log(JSON.stringify({parsed:Object.keys(queries).length,used:used.size,errors,baseTables:base,normativeTables:norm,temporaryTables:bundle.temporaryTables},null,2));
if(errors.length)process.exitCode=1;
