import { webkit } from 'playwright';
import fs from 'node:fs';
const browser = await webkit.launch({headless:true});
let page;
try {
  page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3});
  const issues=[];
  page.on('pageerror',e=>issues.push('PAGE ERROR: '+e.message));
  page.on('console',m=>{if(m.type()==='error')issues.push('CONSOLE ERROR: '+m.text());});
  await page.goto('http://127.0.0.1:8765/solin-field/mdb-wasm-poc/', {waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('button',{name:/Создать тестовый MDB/}).waitFor({timeout:90000});
  const dl=page.waitForEvent('download',{timeout:120000});
  await page.getByRole('button',{name:/Создать тестовый MDB/}).click();
  const download=await dl;
  if(download.suggestedFilename()!=='TEST_Transf_213_2_2026.mdb')
    throw Error('Unexpected test export filename: '+download.suggestedFilename());
  const path=await download.path();
  const bytes=fs.readFileSync(path);
  if(bytes.length<4096||bytes.toString('latin1',4,19)!=='Standard Jet DB')
    throw Error('Downloaded file is NOT an Access MDB.');
  const msg=await page.getByRole('status').innerText();
  if(!msg.includes('Успешно'))throw Error('WASM exporter status not successful: '+msg);
  console.log('WEBKIT_MDB_OK: '+download.suggestedFilename()+
    ' ('+bytes.length+' bytes), local filesystem write/read, user-click download');
} catch(e){
  console.error('WEBKIT_MDB_FAIL: '+e.stack);
  if(page){console.error('Status: '+await page.getByRole('status').innerText().catch(()=>''));}
  await page?.screenshot({path:'/tmp/mdb-wasm-failure.png'}).catch(()=>{});
  process.exitCode=1;
} finally {
  await browser.close();
}
