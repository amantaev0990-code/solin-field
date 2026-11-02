'use strict';
const fs=require('node:fs'),zlib=require('node:zlib');
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync('refs-audit.json.gz')).toString());
const t=raw.tables||raw;
const rows=t.Szap||[],ck=t.SzapCK||[];
const counts=(ls,key)=>[...new Map([...new Set(ls.map(x=>String(x[key]??'')))].map(v=>[v,ls.filter(x=>String(x[key]??'')===v).length])).entries()].sort((a,b)=>b[1]-a[1]).slice(0,30);
console.log('SZAP_META',JSON.stringify({total:rows.length,first:rows.slice(0,2),columns:Object.keys(rows[0]||{}),Obl:counts(rows,'Obl'),CKObl:counts(ck,'Obl')}));
for(const obl of [150000000,350000000,35,150,350,7,700]){
 let subset=rows.filter(x=>Number(x.Obl)===obl);console.log('SZAP_OBL',obl,subset.length,
 JSON.stringify({lxz:counts(subset,'LXZ'),species:counts(subset,'p1'),kul:counts(subset,'KUL'),examples:subset.slice(0,12).map(x=>({Obl:x.Obl,p1:x.p1,LXZ:x.LXZ,KUL:x.KUL,v6:x.v6}))}));
}
console.log('SZAP_723_4_ZONES',JSON.stringify(rows.filter(x=>Number(x.Obl)===350000000&&Number(x.LXZ)===8).slice(0,70).map(x=>({p1:x.p1,KUL:x.KUL,v6:x.v6}))));
console.log('SZaP_CHECKS',JSON.stringify({e:'350m and 8',n:rows.filter(x=>Number(x.Obl)===350000000&&Number(x.LXZ)===8).length}));
