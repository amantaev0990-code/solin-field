/* CMF2 direct inline stand-key recovery v6.
   Geometry is immutable.

   New path: do not depend on PSTG/SQLite at all for Nкварт/Nвыд.
   CarryMap stores stand attributes in framed raw-LZ4 column streams immediately
   before the layer PSTG block. On both regression maps the `Ключ` column is a
   self-describing string vector:
     [N one-byte length codes][concatenated UTF-8 values]
   where string length = code >> 1. Values are e.g. `70_5`, `69_2`, ... .

   The stream is discovered structurally, not by offset/name:
   - decoded row count must equal the already decoded stand SpatialBlock count;
   - the length vector must consume the decoded block exactly;
   - >=90% rows must be positive integer pairs q_v;
   - keys must be mostly unique.

   This bypasses builder-specific SQLite/FTS variants while preserving structural-v4
   geometry untouched. PSTG/FTS remains useful only for optional extra attributes. */
(function(){
'use strict';
const MAX_SCAN=512*1024, MAX_COMP=256*1024;
function standLayer(info){return(info?.geometryLayers||[]).find(g=>/выдпород|выдел/i.test(g.source||''))||null}
function readVarint(raw,p){let v=0,s=0;for(let i=0;i<5&&p+i<raw.length;i++){const b=raw[p+i];v+=(b&127)*Math.pow(2,s);if(b<128)return{value:v,length:i+1};s+=7}return null}
function decodeExact(raw,start,expected,end){let i=start,out=[];end=Math.min(end,raw.length);try{while(i<end&&out.length<expected){const token=raw[i++];let lit=token>>>4;if(lit===15){let x;do{if(i>=end)return null;x=raw[i++];lit+=x}while(x===255)}if(i+lit>end||out.length+lit>expected)return null;for(let k=0;k<lit;k++)out.push(raw[i+k]);i+=lit;if(out.length===expected)return{bytes:new Uint8Array(out),inputEnd:i};if(i+1>=end)return null;const off=raw[i]|raw[i+1]<<8;i+=2;if(!off||off>out.length)return null;let m=token&15;if(m===15){let x;do{if(i>=end)return null;x=raw[i++];m+=x}while(x===255)}m+=4;if(out.length+m>expected)return null;for(let k=0;k<m;k++)out.push(out[out.length-off])}}catch(_){return null}return out.length===expected?{bytes:new Uint8Array(out),inputEnd:i}:null}
function parseStringVector(bytes,n){if(!bytes||n<1||bytes.length<n)return null;let total=0;const lens=new Array(n);for(let i=0;i<n;i++){const code=bytes[i];/* CarryMap string length is stored shifted left by one; LSB is a flag. */const len=code>>>1;if(len>127)return null;lens[i]=len;total+=len}if(n+total!==bytes.length)return null;const td=new TextDecoder('utf-8',{fatal:false}),vals=new Array(n);let p=n;for(let i=0;i<n;i++){const len=lens[i],s=td.decode(bytes.subarray(p,p+len));p+=len;vals[i]=s}return vals}
function scoreKeys(vals){if(!vals?.length)return null;let hits=0;const seen=new Set();for(const s of vals){if(/^[1-9]\d*_[1-9]\d*$/.test(s)){hits++;seen.add(s)}}const ratio=hits/vals.length,unique=seen.size/Math.max(1,hits);if(ratio<.90||unique<.80)return null;return{ratio,unique,score:ratio*100+unique}}
function findKeyStream(raw,info,stand){const n=stand?.geojson?.features?.length||stand?.count||0;if(!n)return null;const blocks=info?.blocks||[];let end=null;const linked=blocks.find(b=>Number(b?.index)===Number(stand?.storageIndex));if(linked?.offset!=null)end=linked.offset;else if(blocks[stand?.index]?.offset!=null)end=blocks[stand.index].offset;if(!(end>0))return null;let floor=0;const prev=blocks.filter(b=>b?.offset<end).sort((a,b)=>b.offset-a.offset)[0];if(prev?.offset!=null){const len=raw[prev.offset+5]!=null?Number(new DataView(raw.buffer,raw.byteOffset,raw.byteLength).getBigUint64?.(prev.offset+5,true)||0n):0;if(Number.isFinite(len)&&len>0&&prev.offset+len<end)floor=prev.offset+len;else floor=prev.offset+4}const start=Math.max(floor,end-MAX_SCAN),minU=Math.max(n*3,n+1),maxU=Math.min(128*1024,n*32+2048);let best=null;
  for(let p=start;p<end-2;p++){
    const a=readVarint(raw,p);if(!a||a.value<1||a.value>MAX_COMP)continue;const b=readVarint(raw,p+a.length);if(!b||b.value<minU||b.value>maxU)continue;const payload=p+a.length+b.length;if(payload+a.value>end)continue;const d=decodeExact(raw,payload,b.value,payload+a.value);if(!d||d.inputEnd!==payload+a.value)continue;const vals=parseStringVector(d.bytes,n);if(!vals)continue;const sc=scoreKeys(vals);if(!sc)continue;const cand={...sc,offset:p,payload,compressed:a.value,uncompressed:b.value,values:vals};if(!best||cand.score>best.score)best=cand;
  }
  return best
}
function applyKeys(info,stand,hit){if(!hit)return 0;const fs=stand.geojson?.features||[];let applied=0;for(let i=0;i<Math.min(fs.length,hit.values.length);i++){const m=hit.values[i].match(/^([1-9]\d*)_([1-9]\d*)$/);if(!m)continue;const p=fs[i].properties||(fs[i].properties={});p.Nкварт=Number(m[1]);p.Nвыд=Number(m[2]);p['Ключ']=hit.values[i];p._CMF_KEY_SOURCE='inline column stream';applied++}info.inlineKeyV6=true;info.inlineKeyCount=applied;info.inlineKeyOffset=hit.offset;info.inlineKeyConfidence=hit.ratio;info.attributesDecoded=applied>0||info.attributesDecoded;return applied}
async function recover(file,info){const stand=standLayer(info);if(!stand)return info;try{const raw=new Uint8Array(await file.arrayBuffer()),hit=findKeyStream(raw,info,stand);if(hit)applyKeys(info,stand,hit);else info.inlineKeyV6='not-found'}catch(e){console.warn('CMF2 inline key v6',e);info.inlineKeyV6Error=String(e?.message||e)}return info}
function install(){if(typeof window.inspectCmf2!=='function'||window.inspectCmf2._inlineKeyV6)return false;const orig=window.inspectCmf2,wrapped=async file=>recover(file,await orig(file));wrapped._inlineKeyV6=true;window.inspectCmf2=wrapped;return true}if(!install())setTimeout(install,0);
window.SolinCmfInlineKeyV6={recover,findKeyStream,parseStringVector};
})();
