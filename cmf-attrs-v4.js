/* CMF2 forestry attributes v4.
   Geometry is immutable here. This module uses the exact PSTG decoder, selects the
   embedded FTS4 database by schema + exact object count, restores Nкварт/Nвыд from
   token positions and also exposes the other indexed forestry fields to the popup.
   No forest-name or filename conditions. */
(function(){
'use strict';
let sqlPromise=null;
function rows(res){if(!res?.length)return[];const c=res[0].columns;return res[0].values.map(v=>Object.fromEntries(c.map((k,i)=>[k,v[i]])))}
async function getSQL(){if(window.SQL?.Database)return window.SQL;if(!window.initSqlJs)return null;if(!sqlPromise)sqlPromise=window.initSqlJs({locateFile:f=>'https://unpkg.com/sql.js@1.10.3/dist/'+f});return sqlPromise}
function standLayer(info){return(info?.geometryLayers||[]).find(g=>/выдпород|выдел/i.test(g.source||''))||null}
function cols(db){try{return rows(db.exec('pragma table_info(idx)')).map(r=>({cid:Number(r.cid),name:String(r.name)}))}catch(_){return[]}}
function docCount(db){try{return Number(rows(db.exec('select count(*) as n from idx_docsize'))[0]?.n)||0}catch(_){}try{return Number(rows(db.exec('select count(*) as n from idx_content'))[0]?.n)||0}catch(_){}return 0}
function makeAux(db){try{db.run('DROP TABLE IF EXISTS cmf_attr_aux4')}catch(_){}try{db.run('CREATE VIRTUAL TABLE cmf_attr_aux4 USING fts4aux(idx)');return true}catch(_){return false}}
function allTerms(db,cid){try{return rows(db.exec(`select term, documents from cmf_attr_aux4 where col=${Number(cid)} order by term`)).map(r=>({term:String(r.term),documents:Number(r.documents)||0}))}catch(_){return[]}}
function safeCol(s){return String(s).replace(/[^0-9A-Za-zА-Яа-яЁё_$]/g,'')}
function safeTerm(s){return String(s).replace(/'/g,"''")}
function docsFor(db,col,term){const c=safeCol(col),t=safeTerm(term);if(!c||!t)return[];try{return rows(db.exec(`select docid from idx where idx match '${c}:${t}'`)).map(r=>Number(r.docid)).filter(Number.isFinite)}catch(_){return[]}}
function phraseAt(db,doc,a,b){try{return rows(db.exec(`select docid from idx where docid=${Number(doc)} and idx match '"${String(a).replace(/"/g,'')} ${String(b).replace(/"/g,'')}"' limit 1`)).length>0}catch(_){return false}}
function exactPair(db,doc,ts){
  if(ts.length===1&&phraseAt(db,doc,ts[0],ts[0]))return[ts[0],ts[0]];
  for(const a of ts)for(const b of ts)if(a!==b&&phraseAt(db,doc,a,b))return[a,b];
  return null;
}
function ringAreaHa(r){if(!Array.isArray(r)||r.length<3)return 0;const lat0=r.reduce((s,p)=>s+(+p[1]||0),0)/r.length,ky=111320,kx=111320*Math.cos(lat0*Math.PI/180);let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=(p[0]*kx)*(q[1]*ky)-(q[0]*kx)*(p[1]*ky)}return Math.abs(a)/2/10000}
function areaHa(g){if(!g)return 0;if(g.type==='Polygon')return Math.abs(g.coordinates.reduce((s,r,i)=>s+(i?-1:1)*ringAreaHa(r),0));if(g.type==='MultiPolygon')return g.coordinates.reduce((s,p)=>s+Math.abs(p.reduce((z,r,i)=>z+(i?-1:1)*ringAreaHa(r),0)),0);return 0}
async function openDbs(file,info){
  const rebuild=window.SolinCmfRuntime?.rebuildPageStorage,S=await getSQL();if(!rebuild||!S)return[];
  const raw=new Uint8Array(await file.arrayBuffer()),blocks=info?.blocks||[],out=[];
  for(let i=0;i<blocks.length;i++){
    const b=blocks[i];if(b?.offset==null)continue;const next=blocks.slice(i+1).find(x=>x?.offset>b.offset)?.offset;
    let bytes=null;try{bytes=rebuild(raw,b.offset,next)}catch(_){}if(!bytes)continue;
    let db=null;try{db=new S.Database(bytes);const c=cols(db);if(!c.length){db.close();continue}const aux=makeAux(db);out.push({block:b,db,cols:c,count:docCount(db),aux})}catch(_){try{db?.close()}catch(__){}}
  }
  return out;
}
function chooseStandDb(dbs,stand){
  const n=stand?.geojson?.features?.length||stand?.count||0,candidates=dbs.filter(x=>x.aux&&x.cols.some(c=>/^Ключ$/i.test(c.name)));
  if(!candidates.length)return null;
  candidates.sort((a,b)=>{
    const ae=a.count===n?0:1,be=b.count===n?0:1;if(ae!==be)return ae-be;
    const al=a.block?.layer===stand?.source?0:1,bl=b.block?.layer===stand?.source?0:1;if(al!==bl)return al-bl;
    return Math.abs(a.count-n)-Math.abs(b.count-n)
  });
  const best=candidates[0];
  /* Never attach an unrelated FTS database to geometry. Exact count is our hard join. */
  return best?.count===n?best:null;
}
function quarterSet(dbs){
  let best=null;for(const x of dbs){if(!x.aux)continue;const c=x.cols.find(v=>/^TEXTSTRING$/i.test(v.name));if(!c)continue;const ts=allTerms(x.db,c.cid).filter(t=>/^\d+$/.test(t.term)&&+t.term>0&&+t.term<100000);if(!ts.length)continue;const strong=/номкв|номер.*кв/i.test(String(x.block?.layer||''));const score=(strong?1e6:0)+ts.length;if(!best||score>best.score)best={score,set:new Set(ts.map(t=>t.term))}}return best?.set||new Set()
}
function recoverColumn(db,col,n){
  const per=Array.from({length:n},()=>[]),terms=allTerms(db,col.cid);
  for(const x of terms){for(const d of docsFor(db,col.name,x.term)){if(d>=0&&d<n)per[d].push(x.term)}}
  return per.map(a=>[...new Set(a)]);
}
function recoverStand(sdb,stand,qset){
  const fs=stand.geojson?.features||[],n=fs.length,key=sdb.cols.find(c=>/^Ключ$/i.test(c.name));if(!key)return{applied:0,exact:0};
  const keyPer=recoverColumn(sdb.db,key,n),freq=new Map(allTerms(sdb.db,key.cid).filter(x=>/^\d+$/.test(x.term)).map(x=>[x.term,x.documents]));
  const otherCols=sdb.cols.filter(c=>!/^\$OID\$$/i.test(c.name)&&!/^Ключ$/i.test(c.name));
  const recovered=new Map();for(const c of otherCols)recovered.set(c.name,recoverColumn(sdb.db,c,n));
  let applied=0,exact=0;
  for(let i=0;i<n;i++){
    const f=fs[i],p=f.properties||(f.properties={}),ts=(keyPer[i]||[]).filter(t=>/^\d+$/.test(t));let pair=exactPair(sdb.db,i,ts),isExact=!!pair;
    if(!pair&&ts.length>=2){const qhits=ts.filter(t=>qset.has(t));let q=qhits.length===1?qhits[0]:null;if(!q)q=ts.slice().sort((a,b)=>(freq.get(a)||999999)-(freq.get(b)||999999)||Number(b)-Number(a))[0];const v=ts.find(t=>t!==q);if(v)pair=[q,v]}
    if(pair){p.Nкварт=Number(pair[0]);p.Nвыд=Number(pair[1]);p['Ключ']=`${pair[0]}_${pair[1]}`;applied++;if(isExact)exact++}
    for(const c of otherCols){const vals=recovered.get(c.name)?.[i]||[];if(!vals.length)continue;const value=vals.join(' ');if(c.name==='Лесничеств')p['Лесничество']=value.charAt(0).toUpperCase()+value.slice(1);else p[c.name]=value}
    const a=areaHa(f.geometry);if(a>0){const v=Math.round(a*10)/10;p['Площ_геом']=v;if(p['Площ']==null)p['Площ']=v}
  }
  return{applied,exact};
}
async function recover(file,info){
  const stand=standLayer(info);if(!stand?.count)return info;let dbs=[];
  try{
    dbs=await openDbs(file,info);const sdb=chooseStandDb(dbs,stand);
    if(!sdb){info.attributeRecoveryV4='no-exact-stand-db';return info}
    const qs=quarterSet(dbs),st=recoverStand(sdb,stand,qs);
    info.attributeRecoveryV4=true;info.attributeRecoveryCount=st.applied;info.attributeRecoveryExact=st.exact;info.attributeStandDbIndex=sdb.block?.index;info.attributeStandDbCount=sdb.count;info.attributeQuarterDictionarySize=qs.size;info.attributesDecoded=st.applied>0;
    return info;
  }catch(e){console.warn('CMF2 attrs v4',e);info.attributeRecoveryV4Error=String(e?.message||e);return info}
  finally{for(const x of dbs)try{x.db?.close()}catch(_){}}
}
function install(){if(typeof window.inspectCmf2!=='function'||window.inspectCmf2._attrsV4)return false;const orig=window.inspectCmf2,wrapped=async file=>recover(file,await orig(file));wrapped._attrsV4=true;window.inspectCmf2=wrapped;return true}
if(!install())setTimeout(install,0);
window.SolinCmfAttrsV4={recover};
})();
