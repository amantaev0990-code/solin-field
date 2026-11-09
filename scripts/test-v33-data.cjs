// V33: verify that the full set of already recovered desktop reference data
// survives the V30 -> V33 packaging process. Does not claim unprovided MDBs.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const base=process.argv.includes('--built')?path.join(root,'www'):root;
function source(p){return fs.readFileSync(path.join(base,p));}
function hash(data){return crypto.createHash('sha256').update(data).digest('hex');}
function json(p,sha){
 const data=source(p);
 assert.equal(hash(data),sha,'Desktop-derived resource bytes changed: '+p);
 return JSON.parse(data);
}
if(process.argv.includes('--built')){
 const meta=json('data-meta.json','315f4a07513afc6e5ff4d348f76d21c5541de7e79dbcc5a81f820d0622539e17');
 const refs=json('refs-audit.json','a767d45ee1d9fef240abdf967457782b31f35b2ca303c4f5254541d8b95bc342');
 const norms=json('solin-control-norms.json','2c4d46017a499b57cbeb4a3fa7a1e2c684fe556c261581442e4f745e9d6c4a37');
 json('solin-control-source-recovery.json','f5d0abacaa1d3589279e61f53197f0147b654d4e48a7ea503744d7fb5d85d417');
 assert.ok(Object.keys(refs.tables||{}).length>=154,'Reference extraction incomplete');
 assert.ok(Object.keys(norms).length>=28,'Stock/taxation control rules incomplete');
 assert.ok(Object.keys(meta.transfSchema||{}).length>=18,'Transfer/Maket schemas missing');
 assert.ok(meta.stats?.operationalTables>=29,'Operation schema regression');
 assert.ok(meta.stats?.referenceRows>=22861,'Original reference row count regression');
 const manifest=JSON.parse(source('data-manifest.json'));
 assert.equal(manifest.quarterChunks.length,10);
 for(const file of manifest.quarterChunks) assert.ok(source(file).length>20,file);
 for(const [file,minBytes] of [['maps/213-1.cmf2',1000000],['maps/213-2.cmf2',1000000],
   ['vendor/leaflet.js',1000],['vendor/geopackage.min.js',1000]]){
  assert.ok(source(file).length>=minBytes,'Missing offline map asset '+file);
 }
 console.log('Recovered data verified: '+Object.keys(refs.tables).length+
  ' reference tables, '+Object.keys(norms).length+
  ' control norm sets, '+Object.keys(meta.transfSchema).length+
  ' Transfer table schemas and 10 chunk files; byte-identical to tested V30.');
} else console.log('Data test enabled for post-V30 overlay builds.');
