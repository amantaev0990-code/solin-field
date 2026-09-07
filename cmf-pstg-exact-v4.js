/* CMF2 PSTG exact PageStorage decoder v4.
   Attribute-only infrastructure: NEVER changes geometry.

   Reverse engineered invariant verified on all 10 PSTG blocks of both regression files:
   PSTG = 'PSTG' + version byte + uint64LE(totalBlockBytes) + concatenated raw-LZ4
   SQLite pages. totalBlockBytes includes the 13-byte PSTG header. Each LZ4 block expands
   to exactly one SQLite page; there is no guessed cursor gap between pages.

   This replaces the old cursor +/-12 scan, which could lose the embedded FTS database
   on another CarryMap export even while geometry decoded correctly. */
(function(){
'use strict';
function be16(b,o){return ((b[o]||0)<<8)|(b[o+1]||0)}
function be32(b,o){return (((b[o]||0)<<24)|((b[o+1]||0)<<16)|((b[o+2]||0)<<8)|(b[o+3]||0))>>>0}
function u64leSafe(b,o){
  if(o+8>b.length)return 0;
  let lo=((b[o])|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;
  let hi=((b[o+4])|(b[o+5]<<8)|(b[o+6]<<16)|(b[o+7]<<24))>>>0;
  const n=lo+hi*4294967296;
  return Number.isSafeInteger(n)?n:0;
}
function isPstg(raw,o){return o>=0&&o+13<=raw.length&&raw[o]===80&&raw[o+1]===83&&raw[o+2]===84&&raw[o+3]===71}
/* Decode only enough output to read the SQLite header. Input end is intentionally not used. */
function decodePrefix(raw,start,need,end){
  let i=start,out=[];end=Math.min(end||raw.length,raw.length);
  try{
    while(i<end&&out.length<need){
      const token=raw[i++];let lit=token>>>4;
      if(lit===15){let x;do{if(i>=end)return null;x=raw[i++];lit+=x}while(x===255)}
      if(i+lit>end)return null;
      for(let k=0;k<lit&&out.length<need;k++)out.push(raw[i+k]);
      if(out.length>=need)return new Uint8Array(out);
      i+=lit;if(i+1>=end)return null;
      const off=raw[i]|(raw[i+1]<<8);i+=2;if(!off||off>out.length)return null;
      let m=token&15;if(m===15){let x;do{if(i>=end)return null;x=raw[i++];m+=x}while(x===255)}m+=4;
      for(let k=0;k<m&&out.length<need;k++)out.push(out[out.length-off]);
    }
  }catch(_){return null}
  return out.length>=need?new Uint8Array(out):null;
}
/* A raw-LZ4 block with a known uncompressed size can be ended exactly. */
function decodeExact(raw,start,expected,end){
  let i=start,out=[];end=Math.min(end||raw.length,raw.length);
  try{
    while(i<end&&out.length<expected){
      const token=raw[i++];let lit=token>>>4;
      if(lit===15){let x;do{if(i>=end)return null;x=raw[i++];lit+=x}while(x===255)}
      if(i+lit>end||out.length+lit>expected)return null;
      for(let k=0;k<lit;k++)out.push(raw[i+k]);i+=lit;
      if(out.length===expected)return{bytes:new Uint8Array(out),inputEnd:i};
      if(i+1>=end)return null;
      const off=raw[i]|(raw[i+1]<<8);i+=2;if(!off||off>out.length)return null;
      let m=token&15;if(m===15){let x;do{if(i>=end)return null;x=raw[i++];m+=x}while(x===255)}m+=4;
      if(out.length+m>expected)return null;
      for(let k=0;k<m;k++)out.push(out[out.length-off]);
    }
  }catch(_){return null}
  return out.length===expected?{bytes:new Uint8Array(out),inputEnd:i}:null;
}
function plausibleSqliteHeader(h){
  if(!h||h.length<64)return null;
  const magic=String.fromCharCode(...h.slice(0,15));if(magic!=='SQLite format 3')return null;
  let pageSize=be16(h,16);if(pageSize===1)pageSize=65536;
  const pageCount=be32(h,28);
  if(pageSize<512||pageSize>65536||(pageSize&(pageSize-1))||!pageCount||pageCount>65536)return null;
  return{pageSize,pageCount};
}
function exactFromHeader(raw,blockOffset){
  if(!isPstg(raw,blockOffset))return null;
  const total=u64leSafe(raw,blockOffset+5);if(total<14||blockOffset+total>raw.length)return null;
  const start=blockOffset+13,end=blockOffset+total;
  const head=plausibleSqliteHeader(decodePrefix(raw,start,64,end));if(!head)return null;
  let cursor=start;const pages=[];
  for(let p=0;p<head.pageCount;p++){
    const d=decodeExact(raw,cursor,head.pageSize,end);if(!d)return null;
    if(p>0&&!([2,5,10,13].includes(d.bytes[0])))return null;
    pages.push(d.bytes);cursor=d.inputEnd;
  }
  /* In PSTG v2 the compressed pages consume the payload exactly. Refuse a false parse. */
  if(cursor!==end)return null;
  const out=new Uint8Array(head.pageSize*head.pageCount);pages.forEach((p,i)=>out.set(p,i*head.pageSize));
  return{bytes:out,version:raw[blockOffset+4],pageSize:head.pageSize,pageCount:head.pageCount,totalBytes:total,compressedPayloadBytes:total-13,method:'PSTG exact framing'};
}
/* Fallback for a future header variant: scan a very small structural window after PSTG,
   find the LZ4 stream whose prefix is a SQLite header, then decode pages exactly. */
function structuralFallback(raw,blockOffset,nextOffset){
  if(!isPstg(raw,blockOffset))return null;
  const scanEnd=Math.min(nextOffset||raw.length,blockOffset+256);
  for(let start=blockOffset+5;start<scanEnd;start++){
    const pref=decodePrefix(raw,start,64,nextOffset||raw.length),head=plausibleSqliteHeader(pref);if(!head)continue;
    let cursor=start,pages=[],ok=true;
    for(let p=0;p<head.pageCount;p++){
      const d=decodeExact(raw,cursor,head.pageSize,nextOffset||raw.length);if(!d){ok=false;break}
      if(p>0&&!([2,5,10,13].includes(d.bytes[0]))){ok=false;break}
      pages.push(d.bytes);cursor=d.inputEnd;
    }
    if(!ok)continue;
    const out=new Uint8Array(head.pageSize*head.pageCount);pages.forEach((p,i)=>out.set(p,i*head.pageSize));
    return{bytes:out,version:raw[blockOffset+4],pageSize:head.pageSize,pageCount:head.pageCount,totalBytes:cursor-blockOffset,compressedPayloadBytes:cursor-start,method:'PSTG structural fallback'};
  }
  return null;
}
function rebuildPageStorage(raw,blockOffset,nextOffset){
  const r=exactFromHeader(raw,blockOffset)||structuralFallback(raw,blockOffset,nextOffset);
  return r?.bytes||null;
}
function install(){
  if(!window.SolinCmfRuntime)return false;
  window.SolinCmfRuntime.rebuildPageStorage=rebuildPageStorage;
  window.SolinCmfRuntime.rebuildPageStorageDetailed=(raw,o,n)=>exactFromHeader(raw,o)||structuralFallback(raw,o,n);
  return true;
}
if(!install())setTimeout(install,0);
window.SolinCmfPstgExactV4={rebuildPageStorage,exactFromHeader,structuralFallback,decodeExact};
})();
