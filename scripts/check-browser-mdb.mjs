// Independent readback of the Java-written MDB with the EXACT parser used in
// Safari (vendor/mdb-reader.bundle.js). A Java-Jackcess-only test is insufficient.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const [mdbPath,snapshotPath]=process.argv.slice(2);
if(!mdbPath||!snapshotPath)throw Error('Usage: node scripts/check-browser-mdb.mjs populated.mdb snapshot.json');
const expected=JSON.parse(fs.readFileSync(snapshotPath,'utf8')).tables;
const binary=fs.readFileSync(mdbPath);
assert.equal(binary.toString('latin1',4,19),'Standard Jet DB');
const context=vm.createContext({console,Buffer,Uint8Array,ArrayBuffer,TextDecoder,TextEncoder,Date});
vm.runInContext(fs.readFileSync('vendor/mdb-reader.bundle.js','utf8'),context,{
 timeout:30000,filename:'mdb-reader.bundle.js'
});
const MDB=context.SolinMDB;
assert.ok(MDB?.Reader && MDB?.Buffer,'Missing browser MDB parser');
const reader=new MDB.Reader(MDB.Buffer.from(binary));
const names=reader.getTableNames({normalTables:true,systemTables:false,linkedTables:false});
assert.ok(names.includes('Лесничество'),'Browser MDB reader misses forestry table');
const failures=[];
for(const [name,rows]of Object.entries(expected)){
 const t=reader.getTable(name);
 let parsed=[];
 try{parsed=t.getData();}catch(e){failures.push({name,expected:rows.length,error:e.message});continue;}
 const parsedCount=parsed.length;
 const recordCount=t.rowCount;
 console.log(JSON.stringify({table:name,originalRows:rows.length,readerRowCount:recordCount,readerParsedRows:parsedCount,
   example:parsed[0]?Object.fromEntries(Object.entries(parsed[0]).slice(0,5)):null}));
 if(parsedCount!==rows.length)failures.push({name,expected:rows.length,tableRowCount:recordCount,parsedCount});
}
if(failures.length){
 console.error('BROWSER_MDB_READER_MISMATCH: '+JSON.stringify(failures));
 process.exitCode=1;
}else{
 console.log('BROWSER_MDB_READER_OK: full table counts and forestry record parsed');
}
