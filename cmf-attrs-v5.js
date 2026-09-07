/* CMF2 forestry attributes v5.
   Geometry is immutable here.

   Main change vs v4: do NOT require PSTG document count == geometry object count.
   structural-v4 already gives us the authoritative geometry storageIndex. We first
   open the PSTG block from that storage slot, confirm the FTS schema contains Ключ,
   then join FTS documents back to polygons by the indexed $OID$ (or FID) value.
   This survives sparse indexes, omitted rows, 0/1-based docids and builder variants.
*/
(function(){
'use strict';
let sqlPromise=null;
function rows(res){if(!res?.length)return[];const c=res[0].columns;return res[0].values.map(v=>Object.fromEntries(c.map((k,i)=>[k,v[i]])))}
async function getSQL(){if(window.SQL?.Database)return window.SQL;if(!window.initSqlJs)return null;if(!sqlPromise)sqlPromise=window.initSqlJs({locateFile:f=>'https://unpkg.com/sql.js@1.10.3/dist/'+f});return sqlPromise}
function standLayer(info){return(info?.geometryLayers||[]).find(g=>/выдпород|выдел/i.test(g.source||''))||null}
function cols(db){try{return rows(db.exec('pragma table_info(idx)')).map(r=>({cid:Number(r.cid),name:String(r.name)}))}catch(_){return[]}}
function docCount(db){try{return Number(rows(db.exec('select count(*) as n from idx_docsize'))[0]?.n)||0}catch(_){}try{return Number(rows(db.exec('select count(*) as n from idx_content'))[0]?.n)||0}catch(_){}return 0}
function makeAux(db){try{db.run('DROP TABLE IF EXISTS cmf_attr_aux5')}catch(_){}try{db.run('CREATE VIRTUAL TABLE cmf_attr_aux5 USING fts4aux(idx)');return true}catch(_){return false}}
function allTerms(db,cid){try{return rows(db.exec(`select term, documents from cmf_attr_aux5 where col=${Number(cid)} order by term`)).map(r=>({term:String(r.term),documents:Number(r.documents)||0}))}catch(_){return[]}}
function safeCol(s){return String(s).replace(/[^0-9A-Za-zА-Яа-яЁё_$]/g,'')}
function docsFor(db,col,term){const c=safeCol(col),t=String(term).replace(/'/g,"''");if(!c||!t)return[];try{return rows(db.exec(`select docid from idx where idx match '${c}:${t}'`)).map(r=>Number(r.docid)).filter(Number.isFinite)}catch(_){return[]}}
function phraseAt(db,doc,a,b){try{return rows(db.exec(`select docid from idx where docid=${Number(doc)} and idx match '"${String(a).replace(/"/g,'')} ${String(b).replace(/"/g,'')}"' limit 1`)).length>0}catch(_){return false}}
function exactPair(db,doc,ts){if(ts.length===1&&phraseAt(db,doc,ts[0],ts[0]))return[ts[0],ts[0]];for(const a of ts)for(const b of ts)if(a!==b&&phraseAt(db,doc,a,b))return[a,b];return null}
function ringAreaHa(r){if(!Array.isArray(r)||r.length<3)return 0;const lat0=r.reduce((s,p)=>s+(+p[1]||0),0)/r.length,ky=111320,kx=111320*Math.cos(lat0*Math.PI/180);let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=(p[0]*kx)*(q[1]*ky)-(q[0]*kx)*(p[1]*ky)}return Math.abs(a)/2/10000}
function areaHa(g){if(!g)return 0;if(g.type==='Polygon')return Math.abs(g.coordinates.reduce((s,r,i)=>s+(i?-1:1)*ringAreaHa(r),0));if(g.type==='MultiPolygon')return g.coordinates.reduce((s,p)=>s+Math.abs(p.reduce((z,r,i)=>z+(i?-1:1)*ringAreaHa(r),0)),0);return 0}
function termMap(db,col){const per=new Map(),freq=new Map();if(!col)return{per,freq};for(const x of allTerms(db,col.cid)){freq.set(x.term,x.documents);for(const d of docsFor(db,col.name,x.term)){if(!per.has(d))per.set(d,[]);per.get(d).push(x.term)}}for(const[k,v]of per)per.set(k,[...new Set(v)]);return{per,freq}}
function numericOnly(a){return(a||[]).filter(t=>/^\d+$/.test(String(t)))}
async function openDbs(file,info){const S=await getSQL();if(!S)return[];const raw=new Uint8Array(await file.arrayBuffer()),blocks=info?.blocks||[],out=[];for(let i=0;i<blocks.length;i++){const b=blocks[i];if(b?.offset==null)continue;const next=blocks.slice(i+1).find(x=>x?.offset>b.offset)?.offset;let bytes=null,method='';try{const d=window.SolinCmfPstgV5?.rebuildDetailed?.(raw,b.offset,next)||window.SolinCmfRuntime?.rebuildPageStorageDetailed?.(raw,b.offset,next);if(d?.bytes){bytes=d.bytes;method=d.method||''}else bytes=window.SolinCmfRuntime?.rebuildPageStorage?.(raw,b.offset,next)}catch(_){}if(!bytes)continue;let db=null;try{db=new S.Database(bytes);const c=cols(db);if(!c.length){db.close();continue}const a=makeAux(db);out.push({block:b,db,cols:c,count:docCount(db),aux:a,method})}catch(_){try{db?.close()}catch(__){}}}return out}
function oidCoverage(x,n){if(!x?.aux)return{score:-1,coverage:0,shift:0,map:new Map()};const oid=x.cols.find(c=>/^\$OID\$$/i.test(c.name))||x.cols.find(c=>/^FID$/i.test(c.name));if(!oid)return{score:-1,coverage:0,shift:0,map:new Map()};const tm=termMap(x.db,oid).per,vals=[];for(const[doc,ts]of tm){const nums=numericOnly(ts);if(nums.length===1)vals.push({doc,oid:Number(nums[0])})}if(!vals.length)return{score:-1,coverage:0,shift:0,map:new Map()};const candidates=[0,1],scores=candidates.map(shift=>({shift,hits:vals.filter(v=>v.oid-shift>=0&&v.oid-shift<n).length})).sort((a,b)=>b.hits-a.hits),shift=scores[0].shift,map=new Map();for(const v of vals){const fi=v.oid-shift;if(fi>=0&&fi<n&&!map.has(v.doc))map.set(v.doc,fi)}const coverage=map.size/n;return{score:coverage,coverage,shift,map}}
function chooseStandDb(dbs,stand){const n=stand?.geojson?.features?.length||stand?.count||0,cand=dbs.filter(x=>x.aux&&x.cols.some(c=>/^Ключ$/i.test(c.name)));if(!cand.length)return null;
  /* Strongest join: structural-v4 geometry storage slot -> same PSTG slot. */
  const linked=cand.find(x=>Number(x.block?.index)===Number(stand?.storageIndex));if(linked)return{db:linked,join:'structural storageIndex',oid:oidCoverage(linked,n)};
  /* Compatibility fallback: score by how well indexed OIDs cover geometry feature IDs. */
  let best=null;for(const x of cand){const o=oidCoverage(x,n),countPenalty=n?Math.abs(x.count-n)/n:1,score=o.coverage*100-countPenalty;if(!best||score>best.score)best={db:x,join:'OID coverage fallback',oid:o,score}}return best
}
function quarterSet(dbs){let best=null;for(const x of dbs){if(!x.aux)continue;const c=x.cols.find(v=>/^TEXTSTRING$/i.test(v.name));if(!c)continue;const ts=allTerms(x.db,c.cid).filter(t=>/^\d+$/.test(t.term)&&+t.term>0&&+t.term<100000);if(!ts.length)continue;const schemaNames=x.cols.map(z=>z.name).join(' '),strong=/номкв|номер.*кв|И_М_НомКв/i.test(String(x.block?.layer||'')+' '+schemaNames),score=(strong?1e6:0)+ts.length;if(!best||score>best.score)best={score,set:new Set(ts.map(t=>t.term))}}return best?.set||new Set()}
function recoverStand(chosen,stand,qset){const sdb=chosen.db,fs=stand.geojson?.features||[],n=fs.length,key=sdb.cols.find(c=>/^Ключ$/i.test(c.name));if(!key)return{applied:0,exact:0,mapped:0};const keyTM=termMap(sdb.db,key),oidInfo=chosen.oid?.map?.size?chosen.oid:oidCoverage(sdb,n),docToFeature=new Map(oidInfo.map);if(!docToFeature.size){/* Last fallback: detect 0/1 based contiguous docids. */const docs=[...keyTM.per.keys()].sort((a,b)=>a-b),shift=docs.length&&docs[0]===1?1:0;for(const d of docs){const fi=d-shift;if(fi>=0&&fi<n)docToFeature.set(d,fi)}}
  const otherCols=sdb.cols.filter(c=>!/^\$OID\$$/i.test(c.name)&&!/^Ключ$/i.test(c.name)),other=new Map();for(const c of otherCols)other.set(c.name,termMap(sdb.db,c).per);
  let applied=0,exact=0;const touched=new Set();
  for(const[doc,fi]of docToFeature){if(fi<0||fi>=n)continue;const f=fs[fi],p=f.properties||(f.properties={}),ts=numericOnly(keyTM.per.get(doc));let pair=exactPair(sdb.db,doc,ts),isExact=!!pair;if(!pair){if(ts.length===1&&qset.has(ts[0]))pair=[ts[0],ts[0]];else if(ts.length>=2){const hits=ts.filter(t=>qset.has(t));let q=hits.length===1?hits[0]:null;if(!q&&hits.length>1)q=hits.slice().sort((a,b)=>(keyTM.freq.get(a)||999999)-(keyTM.freq.get(b)||999999)||Number(a)-Number(b))[0];if(!q)q=ts.slice().sort((a,b)=>(keyTM.freq.get(a)||999999)-(keyTM.freq.get(b)||999999)||Number(b)-Number(a))[0];const v=ts.find(t=>t!==q);if(v)pair=[q,v]}}
    if(pair){p.Nкварт=Number(pair[0]);p.Nвыд=Number(pair[1]);p['Ключ']=`${pair[0]}_${pair[1]}`;applied++;if(isExact)exact++}
    for(const c of otherCols){const vals=other.get(c.name)?.get(doc)||[];if(!vals.length)continue;const value=[...new Set(vals)].join(' ');if(c.name==='Лесничеств')p['Лесничество']=value.charAt(0).toUpperCase()+value.slice(1);else p[c.name]=value}
    touched.add(fi)
  }
  for(let i=0;i<n;i++){const p=fs[i].properties||(fs[i].properties={}),a=areaHa(fs[i].geometry);if(a>0){const v=Math.round(a*10)/10;p['Площ_геом']=v;if(p['Площ']==null)p['Площ']=v}}
  return{applied,exact,mapped:touched.size,oidCoverage:oidInfo.coverage||0,oidShift:oidInfo.shift||0}
}
async function recover(file,info){const stand=standLayer(info);if(!stand?.count)return info;let dbs=[];try{dbs=await openDbs(file,info);const chosen=chooseStandDb(dbs,stand);if(!chosen){info.attributeRecoveryV5='no-key-db';return info}const qs=quarterSet(dbs),st=recoverStand(chosen,stand,qs);info.attributeRecoveryV5=true;info.attributeRecoveryJoin=chosen.join;info.attributeRecoveryCount=st.applied;info.attributeRecoveryExact=st.exact;info.attributeMappedFeatures=st.mapped;info.attributeOidCoverage=st.oidCoverage;info.attributeOidShift=st.oidShift;info.attributeStandDbIndex=chosen.db.block?.index;info.attributeStandDbCount=chosen.db.count;info.attributePstgMethod=chosen.db.method;info.attributeQuarterDictionarySize=qs.size;info.attributesDecoded=st.applied>0;return info}catch(e){console.warn('CMF2 attrs v5',e);info.attributeRecoveryV5Error=String(e?.message||e);return info}finally{for(const x of dbs)try{x.db?.close()}catch(_){}}}
function install(){if(typeof window.inspectCmf2!=='function'||window.inspectCmf2._attrsV5)return false;const orig=window.inspectCmf2,wrapped=async file=>recover(file,await orig(file));wrapped._attrsV5=true;window.inspectCmf2=wrapped;return true}
if(!install())setTimeout(install,0);
window.SolinCmfAttrsV5={recover};
})();
