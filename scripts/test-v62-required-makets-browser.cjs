'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path');
const {chromium,devices}=require('playwright');
const root=path.resolve(process.argv[2]||'www');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  const b=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(b);
 }catch{res.writeHead(404).end();}
});
(async()=>{
 let browser;
 try{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  browser=await chromium.launch({channel:process.env.SOLIN_BROWSER_CHANNEL});
  const page=await browser.newPage({...devices['Pixel 7'],viewport:{width:1100,height:730}});
  page.on('pageerror',e=>console.error('PAGE:',e.message));
  await page.route(url=>url.hostname!=='127.0.0.1',route=>route.abort());
  await page.addInitScript(()=>window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',Plugins:{}});
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SolinWorkspace?.ready&&window.SolinCardEditor&&window.SolinQuickCard);
  await page.evaluate(async()=>{
   await window.SolinWorkspace.ready;
   const id=window.SolinWorkspace.activeId;
   if(!id)throw Error('Missing active test forest');
   await window.SolinWorkspace.activate(id);
   const q=Object.values(D.quarters).find(q=>q.compartments?.length);
   if(!q)throw Error('No stand sample');
   const r={...q.compartments[0],KU:31,_children:{}};
   window.SolinCardEditor.open(r,{isNew:true,quick:true});
  });
  const hint=page.locator('#ce-required-makets');
  const base=page.locator('#ce-form [data-ce-scope="base"][data-ce-field="KU"]');
  await hint.waitFor();
  // Make this fixture neutral for the optional K05 landscape requirement.
  await page.evaluate(()=>{
   document.querySelector('[aria-label="Категория ГЛФ, код"]').value='7';
   const zone=document.querySelector('[data-ce-scope="base"][data-ce-field="Fzona"]');
   zone.value='7';zone.dispatchEvent(new Event('change',{bubbles:true}));
  });
  async function check(ku,wanted){
   await base.evaluate((el,code)=>{el.value=String(code);el.dispatchEvent(new Event('change',{bubbles:true}));},ku);
   await page.waitForFunction(args=>{
    const node=document.querySelector('#ce-required-makets');
    const buttons=[...(node?.querySelectorAll('.ce-source-required-maket')||[])].map(x=>x.textContent.trim());
    return buttons.join(',')===args.wanted.join(',')&&node?.hidden===!args.wanted.length;
   },{wanted});
   const actual=await hint.locator('button').allInnerTexts();
   assert.deepEqual(actual,wanted,'Wrong on-screen mandatory makets for category '+ku);
   assert.equal(await hint.isVisible(),wanted.length>0,'Banner visible for KU '+ku);
  }
  await check(31,['М13']);
  await hint.getByRole('button',{name:/Макет 13/}).click();
  assert.equal(await page.locator('#ce-extra').getAttribute('data-form'),'Макет13');
  await check(21,['М17']);
  await check(22,['М17']);
  await check(23,['М17']);
  await check(60,['М19']);
  await check(43,['М25']);
  await check(44,['М25']);
  await check(11,['М12']);
  await check(12,['М12']);
  await check(13,['М12']);
  await check(19,['М10','М11']);
  await check(1,['М10']);
  await hint.getByRole('button',{name:/Макет 10/}).click();
  assert.equal(await page.locator('#ce-main').isVisible(),true);
  await check(83,[]);
  // K05 is not a category flag: it is mandatory for specific KGLF or Fzona.
  await page.evaluate(()=>{
   const z=document.querySelector('[data-ce-scope="base"][data-ce-field="Fzona"]');
   z.value='3';z.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>document.querySelector('#ce-required-makets .ce-source-required-maket')?.textContent==='М21');
  assert.deepEqual(await hint.locator('button').allInnerTexts(),['М21']);
  await page.evaluate(()=>{
   const z=document.querySelector('[data-ce-scope="base"][data-ce-field="Fzona"]');
   z.value='7';z.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>document.getElementById('ce-required-makets')?.hidden===true);
  console.log('V62_BROWSER_REQUIRED_MAKETS_OK: M10/11/12/13/17/19/25 conditional, M21 follows Fzona and no nonmandatory banner.');
 }finally{await browser?.close();await new Promise(done=>server.close(done));}
})().catch(e=>{console.error(e);process.exitCode=1;});
