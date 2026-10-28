import { webkit } from 'playwright';
import fs from 'node:fs';
import vm from 'node:vm';

const meta=JSON.parse(fs.readFileSync('data-meta.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('data-manifest.json','utf8'));
const quarters=Object.assign({},...manifest.quarterChunks.map(p=>JSON.parse(fs.readFileSync(p,'utf8'))));
const org=meta.lesnichestvo[0];
const forest={id:org.POS+'::'+org.LESN,org,quarters,source:meta.source,extraTables:{},updatedAt:new Date().toISOString(),history:[]};

const browser=await webkit.launch({headless:true});
let page;
try {
  page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,acceptDownloads:true});
  page.on('console',msg=>{if(msg.type()==='error')console.error('BROWSER: '+msg.text());});
  await page.goto('http://127.0.0.1:8765/solin-field/mdb-wasm-poc/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.evaluate(async forest=>{
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open('SOLIN_WORKSPACES_V1',2);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains('forests'))
          request.result.createObjectStore('forests',{keyPath:'id'});
      };
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result;
        const tx=db.transaction('forests','readwrite');
        tx.objectStore('forests').put(forest);
        tx.oncomplete=()=>{localStorage.setItem('solin_active_forest_v1',forest.id);db.close();resolve();};
        tx.onerror=()=>reject(tx.error);
      };
    });
  },forest);
  await page.getByRole('button',{name:/Экспортировать сохранённое лесничество/}).waitFor({timeout:90000});
  const waiting=page.waitForEvent('download',{timeout:180000});
  await page.getByRole('button',{name:/Экспортировать сохранённое лесничество/}).click();
  const download=await waiting;
  if(download.suggestedFilename()!=='TEST_Transf_213_2_2026.mdb')
    throw Error('Export name is wrong: '+download.suggestedFilename());
  const bytes=fs.readFileSync(await download.path());
  if(bytes.toString('latin1',4,19)!=='Standard Jet DB')throw Error('Not an Access Jet file');
  const sandbox={console,Buffer,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,Date};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('vendor/mdb-reader.bundle.js','utf8'),sandbox,
                  {timeout:30000,filename:'mdb-reader.bundle.js'});
  const r=new sandbox.SolinMDB.Reader(sandbox.SolinMDB.Buffer.from(bytes));
  const names=r.getTableNames({normalTables:true,systemTables:false,linkedTables:false});
  if(names.length!==18)throw Error('Expected 18 tables, got '+names.length);
  let rows=0;
  for(const name of names){
    const t=r.getTable(name);
    const data=t.getData();
    if(data.length!==t.rowCount)throw Error('Row count mismatch: '+name);
    rows+=data.length;
  }
  if(rows!==1243)throw Error('Expected 1243 records, got '+rows);
  if(r.getTable('Лесничество').getData().length!==1)throw Error('No forestry row');
  if(r.getTable('Выдел').getData().length!==471)throw Error('Missing stands');
  const status=await page.getByRole('status').innerText();
  if(!status.includes('Успешно'))throw Error('No successful status: '+status);
  console.log('WEBKIT_FULL_TRANSFER_OK: 18 tables, 1243 rows, Jet MDB bytes='+bytes.length);
} catch(e) {
  console.error('WEBKIT_FULL_TRANSFER_FAILED: '+e.stack);
  if(page)console.error('STATUS: '+await page.getByRole('status').innerText().catch(()=>'')); 
  await page?.screenshot({path:'/tmp/solin-mdb-webkit-full-failed.png'}).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
