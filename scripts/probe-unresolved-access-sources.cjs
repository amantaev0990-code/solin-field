'use strict';
const fs=require('node:fs'),zlib=require('node:zlib');
const data=JSON.parse(zlib.gunzipSync(fs.readFileSync('refs-audit.json.gz')).toString());
const t=data.tables||data;
for(const term of ['SFZ','Кл_Рай','SDP','Spzon','Sples','Slxr']){
 const matches=Object.keys(t).filter(x=>x.toLowerCase()===term.toLowerCase());
 for(const key of matches){
  const rows=t[key]||[];
  console.log('FORESTRY_SOURCE_META',key,JSON.stringify({count:rows.length,fields:Object.keys(rows[0]||{}),
   samples:rows.slice(0,key==='SFZ'||key==='Кл_Рай'?35:4)}));
 }
 if(!matches.length)console.log('FORESTRY_SOURCE_MISSING',term);
}
let samples=[];
for(let i=1;i<=10;i++){
 const q=JSON.parse(fs.readFileSync('quarters/q'+i+'.json','utf8'));
 for(const [key,val] of Object.entries(q))for(const r of (val.quarterRows?.length?val.quarterRows:[val.meta||{}])){
  samples.push({KV:r.KV,KGLF:r.KGLF,Fzona:r.Fzona,Raion:r.Raion,Kpz:r.Kpz,Klxr:r.Klxr});
 }
}
console.log('FORESTRY_QUARTER_COUNTS',JSON.stringify({total:samples.length,
 byCategory:Object.groupBy(samples,x=>String(x.KGLF)),zones:[...new Set(samples.map(x=>String(x.Fzona)))],raions:[...new Set(samples.map(x=>String(x.Raion)))],
 pairs:[...new Map(samples.map(x=>[JSON.stringify([x.KGLF,x.Fzona,x.Raion]),{KGLF:x.KGLF,Fzona:x.Fzona,Raion:x.Raion}])).values()].slice(0,70)}).slice(0,11000));
