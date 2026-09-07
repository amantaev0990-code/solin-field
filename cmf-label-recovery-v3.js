/* CMF2 forestry label recovery v3.
   IMPORTANT: this module never changes geometry.
   It reads CarryMap contentless FTS4 indexes correctly:
   - document count comes from idx_docsize (COUNT(*) on contentless idx is invalid),
   - the stand DB is selected by the "Ключ" column + exact SpatialBlock object count,
   - quarter/stand order is recovered from FTS token POSITIONS via phrase queries.
   For a key such as 70_5 the FTS index matches phrase "70 5" but not "5 70".
   This gives exact Nкварт/Nвыд without filename, forest-name or frequency guesses. */
(function(){
'use strict';
let sqlPromise=null;
function rows(res){if(!res?.length)return[];const c=res[0].columns;return res[0].values.map(v=>Object.fromEntries(c.map((k,i)=>[k,v[i]])))}
async function getSQL(){if(window.SQL?.Database)return window.SQL;if(!window.initSqlJs)return null;if(!sqlPromise)sqlPromise=window.initSqlJs({locateFile:f=>'https://unpkg.com/sql.js@1.10.3/dist/'+f});return sqlPromise}
function standLayer(info){return(info?.geometryLayers||[]).find(g=>/выдпород|выдел/i.test(g.source||''))||null}
function cols(db){try{return rows(db.exec('pragma table_info(idx)')).map(r=>({cid:Number(r.cid),name:String(r.name)}))}catch(_){return[]}}
function docCount(db){
  /* contentless FTS4: SELECT count(*) FROM idx raises SQL logic error. */
  try{return Number(rows(db.exec('select count(*) as n from idx_docsize'))[0]?.n)||0}catch(_){}
  try{return Number(rows(db.exec('select count(*) as n from idx_content'))[0]?.n)||0}catch(_){}
  return 0;
}
function schema(db){try{return String(rows(db.exec("select sql from sqlite_master where name='idx' limit 1"))[0]?.sql||'')}catch(_){return''}}
function aux(db){try{db.run('DROP TABLE IF EXISTS cmf_v3_aux')}catch(_){}try{db.run('CREATE VIRTUAL TABLE cmf_v3_aux USING fts4aux(idx)');return true}catch(_){return false}}
function numericTerms(db,cid){try{return rows(db.exec(`select term, documents from cmf_v3_aux where col=${Number(cid)}`)).filter(r=>/^\d+$/.test(String(r.term))).map(r=>({term:String(r.term),documents:Number(r.documents)||0}))}catch(_){return[]}}
function termDocs(db,key,term){const t=String(term).replace(/[^0-9]/g,'');if(!t)return[];try{return rows(db.exec(`select docid from idx where idx match '${String(key).replace(/[^0-9A-Za-zА-Яа-яЁё_]/g,'')}:${t}'`)).map(r=>Number(r.docid)).filter(Number.isFinite)}catch(_){return[]}}
function phraseAt(db,doc,a,b){
  /* Do NOT qualify the phrase with a column. CarryMap's contentless FTS index accepts
     the global phrase and preserves the token positions from the Ключ field. */
  try{return rows(db.exec(`select docid from idx where docid=${Number(doc)} and idx match '"${a} ${b}"' limit 1`)).length>0}catch(_){return false}
}
async function openDbs(file,info){const rebuild=window.SolinCmfRuntime?.rebuildPageStorage,S=await getSQL();if(!rebuild||!S)return[];const raw=new Uint8Array(await file.arrayBuffer()),out=[];for(const b of info.blocks||[]){if(b?.offset==null)continue;let bytes=null;try{bytes=rebuild(raw,b.offset)}catch(_){}if(!bytes)continue;let db=null;try{db=new S.Database(bytes);const c=cols(db);if(!c.length){db.close();continue}const a=aux(db);out.push({block:b,db,cols:c,count:docCount(db),schema:schema(db),aux:a})}catch(_){try{db?.close()}catch(__){}}}return out}
function chooseStandDb(dbs,stand){const cand=dbs.filter(x=>x.aux&&x.cols.some(c=>/^Ключ$/i.test(c.name)));if(!cand.length)return null;const n=stand?.count||stand?.geojson?.features?.length||0;return cand.sort((a,b)=>{
  const ae=a.count===n?0:1,be=b.count===n?0:1;if(ae!==be)return ae-be;
  const am=a.block?.layer===stand?.source?0:1,bm=b.block?.layer===stand?.source?0:1;if(am!==bm)return am-bm;
  return Math.abs(a.count-n)-Math.abs(b.count-n)
})[0]}
function quarterDictionary(dbs){let best=null;for(const x of dbs){if(!x.aux)continue;const c=x.cols.find(v=>/^TEXTSTRING$/i.test(v.name));if(!c)continue;const terms=numericTerms(x.db,c.cid).filter(t=>+t.term>0&&+t.term<100000);if(!terms.length)continue;const strong=/номкв|номер.*кв/i.test(String(x.block?.layer||''))||/И_М_НомКв/i.test(x.schema);const score=(strong?1e6:0)+terms.length;if(!best||score>best.score)best={score,set:new Set(terms.map(t=>t.term))}}return best?.set||new Set()}
function termsByDoc(sdb,n){const key=sdb.cols.find(c=>/^Ключ$/i.test(c.name));if(!key)return{key:null,per:[]};const ts=numericTerms(sdb.db,key.cid),per=Array.from({length:n},()=>[]),freq=new Map(ts.map(x=>[x.term,x.documents]));for(const t of ts){for(const d of termDocs(sdb.db,key.name,t.term)){if(d>=0&&d<n)per[d].push(t.term)}}return{key,per:per.map(a=>[...new Set(a)]),freq}}
function exactPair(db,doc,ts){
  if(ts.length===1){const t=ts[0];if(phraseAt(db,doc,t,t))return[t,t];return null}
  for(const a of ts)for(const b of ts){if(a!==b&&phraseAt(db,doc,a,b))return[a,b]}
  return null
}
function fallbackPair(ts,qset,freq){if(ts.length<2)return null;const qhits=ts.filter(t=>qset.has(t));let q=null;if(qhits.length===1)q=qhits[0];else if(qhits.length>1)q=qhits.slice().sort((a,b)=>(freq.get(a)||999999)-(freq.get(b)||999999)||Number(a)-Number(b))[0];else q=ts.slice().sort((a,b)=>(freq.get(a)||999999)-(freq.get(b)||999999)||Number(b)-Number(a))[0];const v=ts.find(t=>t!==q);return v?[q,v]:null}
function ringAreaHa(r){if(!Array.isArray(r)||r.length<3)return 0;const lat0=r.reduce((s,p)=>s+(+p[1]||0),0)/r.length,ky=111320,kx=111320*Math.cos(lat0*Math.PI/180);let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=(p[0]*kx)*(q[1]*ky)-(q[0]*kx)*(p[1]*ky)}return Math.abs(a)/2/10000}
function areaHa(g){if(!g)return 0;if(g.type==='Polygon')return Math.abs(g.coordinates.reduce((s,r,i)=>s+(i?-1:1)*ringAreaHa(r),0));if(g.type==='MultiPolygon')return g.coordinates.reduce((s,p)=>s+Math.abs(p.reduce((z,r,i)=>z+(i?-1:1)*ringAreaHa(r),0)),0);return 0}
function apply(stand,pairs){const fs=stand?.geojson?.features||[];let applied=0,exact=0,fallback=0;for(let i=0;i<fs.length;i++){const f=fs[i],p=f.properties||(f.properties={}),r=pairs[i];if(r){p.Nкварт=Number(r.q);p.Nвыд=Number(r.v);p['Ключ']=`${r.q}_${r.v}`;p._LABEL_SOURCE=r.exact?'CMF2 FTS4 token positions':'CMF2 FTS4 fallback';applied++;if(r.exact)exact++;else fallback++}const a=areaHa(f.geometry);if(a>0){const v=Math.round(a*10)/10;p['Площ_геом']=v;if(p['Площ']==null)p['Площ']=v}}return{applied,exact,fallback}}
async function recover(file,info){const stand=standLayer(info);if(!stand?.count)return info;let dbs=[];try{dbs=await openDbs(file,info);const sdb=chooseStandDb(dbs,stand);if(!sdb){info.labelRecoveryV3='no-key-db';return info}const n=stand.geojson?.features?.length||stand.count,{per,freq}=termsByDoc(sdb,n),qset=quarterDictionary(dbs),pairs=Array.from({length:n},()=>null);for(let d=0;d<n;d++){const ts=per[d]||[];let p=exactPair(sdb.db,d,ts),isExact=!!p;if(!p)p=fallbackPair(ts,qset,freq);if(p)pairs[d]={q:p[0],v:p[1],exact:isExact}}const st=apply(stand,pairs);info.labelRecoveryV3=true;info.labelRecoveryCount=st.applied;info.labelRecoveryExact=st.exact;info.labelRecoveryFallback=st.fallback;info.labelStandDatabaseIndex=sdb.block?.index;info.labelStandDatabaseCount=sdb.count;info.labelQuarterDictionarySize=qset.size;if(st.applied)info.attributesDecoded=true;return info}catch(e){console.warn('CMF2 label recovery v3',e);info.labelRecoveryV3Error=String(e?.message||e);return info}finally{for(const x of dbs)try{x.db?.close()}catch(_){}}}
function install(){if(typeof window.inspectCmf2!=='function'||window.inspectCmf2._labelRecoveryV3)return false;const orig=window.inspectCmf2,wrapped=async file=>recover(file,await orig(file));wrapped._labelRecoveryV3=true;window.inspectCmf2=wrapped;return true}
if(!install())setTimeout(install,0);
window.SolinCmfLabelRecoveryV3={recover};
})();
