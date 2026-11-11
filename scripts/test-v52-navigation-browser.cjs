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
  if(!file.startsWith(root+path.sep))throw Error('bad path');
  const b=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(b);
 }catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:process.env.SOLIN_BROWSER_CHANNEL});
  const page=await browser.newPage({...devices['Pixel 7'],viewport:{width:1067,height:667}});
  await page.route(url=>url.hostname!=='127.0.0.1',route=>route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SolinWorkspace?.ready&&document.querySelector('#quartersScreen'));
  const result=await page.evaluate(async()=>{
   await window.SolinWorkspace.ready;
   const id=window.SolinWorkspace.activeId;
   if(!id)throw Error('No active forest in test data');
   await window.SolinWorkspace.activate(id);
   return {id,quarterCount:Object.keys(D.quarters||{}).length,standCount:Object.values(D.quarters||{}).reduce((n,q)=>n+(q.compartments?.length||0),0)};
  });
  assert.ok(result.quarterCount>0,'Active forest must have quarters');
  await page.waitForFunction(()=>document.querySelector('#quartersScreen.active'));
  const go=async id=>{
   // The V51 installed shell can hide or replace the obsolete bottom
   // .sectionTab controls. Exercise its actual window.show router instead.
   await page.evaluate(name=>window.show(name),id);
   await page.waitForFunction(name=>document.querySelector('#'+name+'.active'),id,{timeout:8000});
   assert.equal(await page.locator('.screen.active').count(),1,'Exactly one active screen');
  };
  await go('refsScreen');
  await go('mapScreen');
  assert.ok(await page.locator('#mapScreen').isVisible(),'Map screen should render');
  await go('quartersScreen');
  assert.ok(await page.locator('#quartersScreen').isVisible());
  await go('menuScreen');
  assert.ok(await page.locator('#menuScreen').isVisible());
  console.log('V52 tablet navigation PASS: selected forest '+result.id+', '+result.quarterCount+' quarters, '+result.standCount+' stands; refs/map/quarters/menu routed.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
