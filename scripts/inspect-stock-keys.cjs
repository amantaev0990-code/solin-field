'use strict';
const fs=require('node:fs'),zlib=require('node:zlib');
const refs=JSON.parse(zlib.gunzipSync(fs.readFileSync('refs-audit.json.gz')).toString());
const tables=refs.tables||{};
for(const table of ['Szap','SzapCK','SSHB']){
 const rows=tables[table]||[];
 console.log(table,'total',rows.length,'keys',Object.keys(rows[0]||{}).slice(0,28));
 console.log(table,'samples',JSON.stringify(rows.slice(0,3)).slice(0,1200));
 console.log(table,'Obl distinct', [...new Set(rows.map(x=>String(x.Obl)))].slice(0,35));
}
const data=JSON.parse(fs.readFileSync('data-meta.json','utf8'));
console.log('DataMeta top-level keys',Object.keys(data));
console.log('Forest owner sample',JSON.stringify(data.lesnichestvo?.slice(0,5)||data).slice(0,1600));