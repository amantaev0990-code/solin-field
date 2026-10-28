// Generate build-time Transfer snapshot from the repository's existing field
// data. The Java build uses it only to infer field types in a NEW blank MDB.
// Never publish this populated snapshot or the intermediate database.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const meta = JSON.parse(fs.readFileSync(path.join(root, 'data-meta.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data-manifest.json'), 'utf8'));
const quarters = Object.assign({}, ...manifest.quarterChunks.map(p =>
  JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))));
const D = { ...meta, quarters, _transferExtras:{} };
const window = {};
const document = {readyState:'loading',addEventListener:()=>{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'solin-mdb-bridge.js'),'utf8'),
  {D,window,document,console,Date,JSON,Number,Set,Object,Error},
  {timeout:10000,filename:'solin-mdb-bridge.js'});
const transfer = window.SolinMDBBridge?.snapshot?.();
if (!transfer || transfer.format!=='SOLIN-MDB-Bridge-v1' ||
    Object.keys(transfer.tables).length!==18 ||
    !transfer.tables['Выдел']?.length) {
  throw Error('Transfer schema is incomplete; will not publish an empty MDB.');
}
const filename=process.argv[2];
if (!filename) throw Error('Usage: node scripts/prepare-blank-mdb.mjs output.json');
fs.writeFileSync(filename,JSON.stringify(transfer));
console.log('Prepared type hints for '+Object.keys(transfer.tables).length+
  ' tables. This input is temporary and MUST NOT be published.');
