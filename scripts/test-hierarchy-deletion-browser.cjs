/* Two confirmations, exact (KV,KGLF,VD) deletion, persistence, and visible red trash. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const nodePath=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=nodePath.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 try{
  const rel=decodeURIComponent(req.url.split('?')[0]);
  const file=nodePath.resolve(root,'.'+rel);
  if(!file.startsWith(root+nodePath.sep)&&file!==root){res.writeHead(403);return res.end();}
  const p=fs.statSync(file).isDirectory()?nodePath.join(file,'index.html'):file;
  res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');
  res.end(fs.readFileSync(p));
 }catch(_){res.writeHead(404);res.end();}
});
(async()=>{
 let browser;
 try{
  await new Promise(resolve=>server.listen(8158,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('http://127.0.0.1:8158/');
  await page.waitForFunction(()=>window.SolinWorkspace&&window.solinCore);
  await page.evaluate(()=>SolinWorkspace.ready);
  const setup=await page.evaluate(async()=>{
   const forest=(await SolinWorkspace.list())[0];
   if(!forest)throw Error('No fixture forest');
   await SolinWorkspace.activate(forest.id);
   let k1=990001;while(D.quarters[k1]||D.quarters[k1+1])k1+=2;
   const k2=k1+1,org=D.lesnichestvo[0],record=(kv,kglf,vd)=>({
    POS:org.POS,LESN:org.LESN,KV:kv,KGLF:kglf,VD:vd,PLV:1,KU:22,
    _children:{Макет10:[{POS:org.POS,LESN:org.LESN,KV:kv,KGLF:kglf,VD:vd,IAR:1,ZAP:10}]}
   });
   D.quarters[k1]={meta:{POS:org.POS,LESN:org.LESN,KV:k1,KGLF:3},quarterRows:[{POS:org.POS,LESN:org.LESN,KV:k1,KGLF:3}],compartments:[record(k1,3,1),record(k1,3,2)]};
   D.quarters[k2]={meta:{POS:org.POS,LESN:org.LESN,KV:k2,KGLF:3},quarterRows:[{POS:org.POS,LESN:org.LESN,KV:k2,KGLF:3},{POS:org.POS,LESN:org.LESN,KV:k2,KGLF:4}],compartments:[record(k2,3,1),record(k2,4,1)]};
   solinCore.checkpoint('Temporary deletion test fixture');await SolinWorkspace.persist();refresh();show('quartersScreen');
   return {k1,k2,id:forest.id};
  });
  const {k1,k2,id}=setup;
  const pickQuarter=async k=>{await page.evaluate(()=>renderQuarters());await page.locator('#quarters .record-entry').filter({hasText:'Квартал '+k}).locator('.quarterCard').click();};
  await pickQuarter(k1);
  const trash=page.locator('#qComps .record-entry .record-delete').first();
  assert.equal(await trash.locator('svg').count(),1,'Visible delete control must use colored SVG');
  assert.equal(await trash.evaluate(el=>getComputedStyle(el).color),'rgb(180, 35, 47)','Trash should be red');
  await trash.click();
  assert.match(await page.locator('#modalTitle').innerText(),/1 из 2/);
  await page.locator('#vDeleteCancel1').click();
  assert.equal(await page.evaluate(k=>D.quarters[k].compartments.length,k1),2,'First cancel must preserve stands');
  await trash.click();await page.locator('#vDeleteNext').click();
  assert.match(await page.locator('#modalTitle').innerText(),/2 из 2/);
  await page.locator('#vDeleteFinal').click();
  await page.waitForFunction(k=>D.quarters[k]?.compartments.length===1,k1);
  assert.equal(await page.evaluate(k=>D.quarters[k].compartments[0].VD,k1),2,'Only selected stand removed');
  // Same stand number in two categories: delete by object identity, never by VD alone.
  const sameAddress=await page.evaluate(async({k2,id})=>{
   const q=D.quarters[k2],target=q.compartments.find(r=>Number(r.KGLF)===3);
   await SolinWorkspace.deleteStand(target,id);
   return q.compartments.map(r=>[r.KGLF,r.VD]);
  },{k2,id});
  assert.equal(sameAddress.length,1);
  assert.equal(sameAddress[0][0],4);
  assert.equal(sameAddress[0][1],1);
  // Quarter deletion must show the number of dependent stands and require two steps.
  await page.evaluate(()=>renderQuarters());
  const quarterTrash=page.locator('#quarters .record-entry').filter({hasText:'Квартал '+k1}).locator('.record-delete');
  await quarterTrash.click();
  assert.match(await page.locator('#modalBody').innerText(),/1 выделов/);
  await page.locator('#qDeleteNext').click();
  await page.locator('#qDeleteCancel2').click();
  assert.equal(await page.evaluate(k=>!!D.quarters[k],k1),true,'Second cancel must preserve quarter');
  await quarterTrash.click();await page.locator('#qDeleteNext').click();await page.locator('#qDeleteFinal').click();
  await page.waitForFunction(k=>!D.quarters[k],k1);
  assert.equal(await page.evaluate(k=>D.quarters[k]?.compartments?.length??-1,k2),1,'Neighbor quarter kept');
  // Restart and load the persisted workspace; deleted entries must not reappear.
  await page.reload();await page.waitForFunction(()=>window.SolinWorkspace);
  await page.evaluate(()=>SolinWorkspace.ready);
  const persisted=await page.evaluate(async({id,k1,k2})=>{
   const forest=(await SolinWorkspace.list()).find(f=>f.id===id);
   await SolinWorkspace.activate(id);
   return {deleted:!!forest.quarters[k1],remaining:forest.quarters[k2]?.compartments.map(r=>[r.KGLF,r.VD]),runtimeDeleted:!!D.quarters[k1]};
  },{id,k1,k2});
  assert.equal(persisted.deleted,false,'Quarter must not reappear in IndexedDB');
  assert.equal(persisted.runtimeDeleted,false,'Quarter must not reappear after reload');
  assert.equal(persisted.remaining?.length,1);
  assert.equal(persisted.remaining[0][0],4);
  assert.equal(persisted.remaining[0][1],1);
  assert.deepEqual(errors,[],'No page errors');
  await context.close();
  console.log('HIERARCHY_DELETE_OK: red trash, two confirmations, cancellation, exact KGLF record, cascading quarter delete, reboot persistence');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err);process.exitCode=1;});
