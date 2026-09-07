/* CMF2 PSTG/SQLite decoder v5.
   Attribute infrastructure only: NEVER changes geometry.

   Strategy:
   1) exact PSTG framing when the block header exposes its payload length;
   2) structural scan for an LZ4 stream whose output begins with SQLite format 3;
   3) page-by-page continuation with a bounded gap scan (handles builder variants that
      insert small framing bytes between compressed SQLite pages);
   4) legacy runtime decoder as a final compatibility fallback.
*/
(function(){
'use strict';
const PAGE_TYPES=new Set([2,5,10,13]);
let legacyRebuild=null;
function be16(b,o){return ((b[o]||0)<<8)|(b[o+1]||0)}
function be32(b,o){return (((b[o]||0)<<24)|((b[o+1]||0)<<16)|((b[o+2]||0)<<8)|(b[o+3]||0))>>>0}
function u64leSafe(b,o){if(o+8>b.length)return 0;const lo=((b[o])|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0,hi=((b[o+4])|(b[o+5]<<8)|(b[o+6]<<16)|(b[o+7]<<24))>>>0,n=lo+hi*4294967296;return Number.isSafeInteger(n)?n:0}
function isPstg(raw,o){return o>=0&&o+5<=raw.length&&raw[o]===80&&raw[o+1]===83&&raw[o+2]===84&&raw[o+3]===71}
function decodePrefix(raw,start,need,end){let i=start,out=[];end=Math.min(end??raw.length,raw.length);try{while(i<end&&out.length<need){const token=raw[i++];let lit=token>>>4;if(lit===15){let x;do{if(i>=end)return null;x=raw[i++];lit+=x}while(x===255)}if(i+lit>end)return null;for(let k=0;k<lit&&out.length<need;k++)out.push(raw[i+k]);if(out.length>=need)return new Uint8Array(out);i+=lit;if(i+1>=end)return null;const off=raw[i]|raw[i+1]<<8;i+=2;if(!off||off>out.length)return null;let m=token&15;if(m===15){let x;do{if(i>=end)return null;x=raw[i++];m+=x}while(x===255)}m+=4;for(let k=0;k<m&&out.length<need;k++)out.push(out[out.length-off])}}catch(_){return null}return out.length>=need?new Uint8Array(out):null}
function decodeExact(raw,start,expected,end){let i=start,out=[];end=Math.min(end??raw.length,raw.length);try{while(i<end&&out.length<expected){const token=raw[i++];let lit=token>>>4;if(lit===15){let x;do{if(i>=end)return null;x=raw[i++];lit+=x}while(x===255)}if(i+lit>end||out.length+lit>expected)return null;for(let k=0;k<lit;k++)out.push(raw[i+k]);i+=lit;if(out.length===expected)return{bytes:new Uint8Array(out),inputEnd:i};if(i+1>=end)return null;const off=raw[i]|raw[i+1]<<8;i+=2;if(!off||off>out.length)return null;let m=token&15;if(m===15){let x;do{if(i>=end)return null;x=raw[i++];m+=x}while(x===255)}m+=4;if(out.length+m>expected)return null;for(let k=0;k<m;k++)out.push(out[out.length-off])}}catch(_){return null}return out.length===expected?{bytes:new Uint8Array(out),inputEnd:i}:null}
function sqliteHeader(pref){if(!pref||pref.length<64)return null;let magic='';for(let i=0;i<15;i++)magic+=String.fromCharCode(pref[i]);if(magic!=='SQLite format 3')return null;let pageSize=be16(pref,16);if(pageSize===1)pageSize=65536;const pageCount=be32(pref,28);if(pageSize<512||pageSize>65536||(pageSize&(pageSize-1))||!pageCount||pageCount>65536)return null;return{pageSize,pageCount}}
function validPage(bytes,pageIndex){return pageIndex===0||PAGE_TYPES.has(bytes?.[0])}
function assemble(raw,start,end,method){const head=sqliteHeader(decodePrefix(raw,start,64,end));if(!head)return null;let cursor=start,pages=[];for(let p=0;p<head.pageCount;p++){
    let d=decodeExact(raw,cursor,head.pageSize,end),chosen=cursor;
    if(!d||!validPage(d.bytes,p)){
      d=null;const lo=Math.max(start,cursor-12),hi=Math.min(end-1,cursor+128);
      for(let s=lo;s<=hi;s++){const q=decodeExact(raw,s,head.pageSize,end);if(q&&validPage(q.bytes,p)){d=q;chosen=s;break}}
    }
    if(!d)return null;pages.push(d.bytes);cursor=d.inputEnd;
  }
  const out=new Uint8Array(head.pageSize*head.pageCount);pages.forEach((p,i)=>out.set(p,i*head.pageSize));return{bytes:out,pageSize:head.pageSize,pageCount:head.pageCount,inputStart:start,inputEnd:cursor,method}
}
function exactHeader(raw,o,next){if(!isPstg(raw,o)||o+13>raw.length)return null;const total=u64leSafe(raw,o+5);if(total<14)return null;const end=o+total;if(end>raw.length||(next&&end>next+256))return null;const r=assemble(raw,o+13,end,'PSTG exact header');if(!r)return null;return{...r,version:raw[o+4],totalBytes:total}}
function scanVariant(raw,o,next){if(!isPstg(raw,o))return null;const blockEnd=Math.min(next||raw.length,raw.length),scanEnd=Math.min(blockEnd,o+1024);for(let start=o+5;start<scanEnd;start++){const pref=decodePrefix(raw,start,64,blockEnd);if(!sqliteHeader(pref))continue;const r=assemble(raw,start,blockEnd,'PSTG structural page scan');if(r)return{...r,version:raw[o+4],totalBytes:r.inputEnd-o}}return null}
function rebuildDetailed(raw,o,next){let r=exactHeader(raw,o,next)||scanVariant(raw,o,next);if(r)return r;if(legacyRebuild){try{const b=legacyRebuild(raw,o,next);if(b?.length)return{bytes:b,method:'legacy compatibility',pageSize:0,pageCount:0,inputStart:o,inputEnd:next||raw.length}}catch(_){}}return null}
function rebuildPageStorage(raw,o,next){return rebuildDetailed(raw,o,next)?.bytes||null}
function install(){if(!window.SolinCmfRuntime)return false;if(!legacyRebuild)legacyRebuild=window.SolinCmfRuntime.rebuildPageStorage;window.SolinCmfRuntime.rebuildPageStorage=rebuildPageStorage;window.SolinCmfRuntime.rebuildPageStorageDetailed=rebuildDetailed;return true}
if(!install())setTimeout(install,0);
window.SolinCmfPstgV5={rebuildPageStorage,rebuildDetailed,decodeExact};
})();
