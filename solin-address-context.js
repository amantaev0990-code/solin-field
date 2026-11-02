/* Exact, non-destructive source inheritance for SOLI-N forest → quarter → stand → makets.
 * Manual Field creation historically omitted KlxrVD/Fzona; Access builds them
 * from the quarter's unique row. Never infer a zoning code from a forest name. */
(()=>{'use strict';
const filled=v=>v!==null&&v!==undefined&&String(v).trim()!=='';
const same=(a,b)=>String(a??'').trim()===String(b??'').trim();
const address=['POS','LESN','KV','KGLF','VD'];
function quarterRows(quarter){
 if(!quarter)return [];
 return quarter.quarterRows?.length?quarter.quarterRows:[quarter.meta||{}];
}
function resolveQuarter(stand,quarter){
 if(!stand||!quarter)return null;
 const rows=quarterRows(quarter);
 let matches=rows.filter(q=>
  ['POS','LESN','KV','KGLF'].every(k=>
   !filled(stand[k])||!filled(q[k])||same(stand[k],q[k])));
 if(filled(stand.Fzona))matches=matches.filter(q=>!filled(q.Fzona)||same(q.Fzona,stand.Fzona));
 if(filled(stand.KlxrVD))matches=matches.filter(q=>!filled(q.Klxr)||same(q.Klxr,stand.KlxrVD));
 // Even duplicate rows with the same values are not a unique Access source.
 return matches.length===1?matches[0]:null;
}
function inheritedStand(stand,quarter,org){
 const row=resolveQuarter(stand,quarter),values={};
 const set=(key,v)=>{if(!filled(stand?.[key])&&filled(v))values[key]=v;};
 if(org){
  for(const key of ['POS','LESN'])set(key,org[key]);
 }
 if(row){
  for(const key of ['POS','LESN','KV','KGLF','Fzona'])set(key,row[key]);
  if(Number(row.Klxr)>0)set('KlxrVD',row.Klxr); // Verified identical in all 471 source records.
 }
 return {row,values,reason:row?'Единственная строка квартала по полному адресу':'Отсутствует однозначная строка квартала'};
}
function enrichStand(stand,quarter,org){
 const ctx=inheritedStand(stand,quarter,org);
 for(const [key,value] of Object.entries(ctx.values))stand[key]=value;
 return ctx;
}
function enrichMakets(stand){
 let added=0;
 for(const [table,rows] of Object.entries(stand?._children||{})){
  if(!/^Макет\d+$/.test(table)||!Array.isArray(rows))continue;
  for(const child of rows)for(const key of address){
   if(!filled(child[key])&&filled(stand[key])){child[key]=stand[key];added++;}
  }
 }
 return added;
}
function originalKTO(pos,lesn){
 const rows=(window.SOLIN_FOREST_CATALOG?.rows||[]).filter(r=>
  same(r[0],pos)&&same(r[1],lesn)&&Number.isFinite(Number(r[4]))&&Number(r[4])>0);
 return rows.length===1?Number(rows[0][4]):null;
}
window.SolinAddressContext={quarterRows,resolveQuarter,inheritedStand,enrichStand,enrichMakets,originalKTO};
})();
