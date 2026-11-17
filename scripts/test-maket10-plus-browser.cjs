'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium,devices}=require('playwright');

const root=path.resolve(process.argv[2]||'www');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  const data=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(data);
 }catch{res.writeHead(404).end();}
});

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.SOLIN_CHROMIUM_PATH});
  const page=await browser.newPage({...devices['Pixel 7'],viewport:{width:1280,height:800}});
  page.setDefaultTimeout(8000);
  await page.route(url=>url.hostname!=='127.0.0.1',route=>route.abort());
  await page.addInitScript(()=>window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',Plugins:{}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SolinWorkspace?.activeId&&window.SOLIN_REFS?.tables?.Szap);
  await page.evaluate(async()=>{
   await window.SolinWorkspace.ready;
   await window.SolinWorkspace.activate(window.SolinWorkspace.activeId);
   const record=D.quarters['1'].compartments.find(row=>row.KU===1&&row.KlxrVD===8);
   if(!record)throw Error('Test stand missing');
   Object.assign(record,{M3Pr:'ОС',M3B:'0',STUR1:null,STUR:null,PLV:1});
   const address=Object.fromEntries(['POS','LESN','KV','KGLF','VD'].map(key=>[key,record[key]]));
   record._children.Макет10=[
    {...address,IAR:1,KOEF:10,POR:'ОС',LET:30,PH:8,PD2:16,KT:0,PROI:1,POL:0.7,ZAP:55},
    {...address,IAR:1,KOEF:null,POR:'Б',LET:50,PH:10,PD2:26,KT:0,PROI:1,POL:null,ZAP:null}
   ];
   current=record;
   renderComp();
   show('card');
  });
  const quick=page.locator('#card').getByRole('button',{name:'Быстрый ввод',exact:true});
  const form=page.locator('#ce-form');
  const row=form.locator('#ce-table-Макет10 tbody tr').nth(1);
  const coefficient=row.locator('[data-ce-field="KOEF"]');
  const plusButton=row.getByRole('button',{name:'Плюсовая порода',exact:true});
  const save=form.getByRole('button',{name:'Сохранить',exact:true});

  async function openMaket(){
   await quick.click();
   await form.getByRole('button',{name:'Макет 10',exact:true}).click();
  }
  await openMaket();
  assert.equal(await coefficient.inputValue(),'');
  assert.equal(await coefficient.getAttribute('placeholder'),'—','Empty coefficient must not look like 0');
  await plusButton.tap();
  assert.equal(await coefficient.inputValue(),'0');
  assert.equal(await plusButton.getAttribute('aria-pressed'),'true');
  assert.equal(await form.locator('#ce-stock-audit').getAttribute('data-stock-status'),'complete');
  await plusButton.tap();
  assert.equal(await coefficient.inputValue(),'');
  assert.equal(await plusButton.getAttribute('aria-pressed'),'false');
  await save.click();
  assert.match(await form.locator('#ce-error').textContent(),/заполните коэффициент/);

  await coefficient.fill('0');
  await coefficient.press('Enter');
  assert.equal(await coefficient.inputValue(),'0');
  assert.equal(await plusButton.getAttribute('aria-pressed'),'true');
  await save.click();
  await form.waitFor({state:'detached'});
  const saved=await page.evaluate(()=>({rows:current._children.Макет10,perHa:current.STUR1,total:current.STUR}));
  assert.deepEqual(saved.rows.map(({POR,KOEF})=>[POR,KOEF]),[['ОС',10],['Б',0]]);
  assert.equal(saved.perHa,55);
  assert.equal(saved.total,55);

  await openMaket();
  assert.equal(await coefficient.inputValue(),'0');
  await plusButton.tap();
  await coefficient.evaluate(el=>{el.value='0';}); // Last IME value just before a touch on Save.
  await save.click();
  await form.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>current._children.Макет10.find(row=>row.POR==='Б').KOEF),0);
  console.log('MAKET10_PLUS_BROWSER_OK: 10 ОС + Б, stock 55, toggle, typed zero, Save and reopen.');
 }finally{
  await browser?.close();
  server.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
