/* SOLI-N Field V25 UI acceptance test. Read-only except edits discarded in draft. */
'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),port=8181;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png'};
const server=http.createServer((req,res)=>{
 try{
  const rel=decodeURIComponent(req.url.split('?')[0]);
  const f=path.resolve(root,'.'+rel);
  if(f!==root&&!f.startsWith(root+path.sep))throw Error('forbidden');
  const file=fs.statSync(f).isDirectory()?path.join(f,'index.html'):f;
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(fs.readFileSync(file));
 }catch{res.statusCode=404;res.end('missing');}
});
(async()=>{
 let browser;
 try{
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1024,height:800},hasTouch:true});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto('http://127.0.0.1:'+port+'/');
  await page.waitForFunction(()=>window.SolinWorkspace&&window.SolinV25UI&&window.SolinCardEditor);
  await page.evaluate(()=>SolinWorkspace.ready);
  assert.equal(await page.locator('.sectionTabs .sectionTab').count(),5,'Five primary tabs only');
  assert(await page.locator('body.solin-v25').count(),'Clean mode must activate');
  await page.evaluate(async()=>{
   const f=(await SolinWorkspace.list())[0];
   await SolinWorkspace.activate(f.id);
   current=Object.values(D.quarters).flatMap(q=>q.compartments||[]).find(r=>r._children?.Макет10?.length)||
        Object.values(D.quarters).flatMap(q=>q.compartments||[])[0];
   renderComp();show('card');
  });
  assert.equal(await page.locator('#v25MaketChoice').count(),1,'One Maket select instead of list of fifteen buttons');
  assert.equal(await page.locator('.v25-card-actions').count(),1,'One compact action toolbar');
  await page.locator('#wfEditBase').click();
  await page.locator('#ce-form.v25-tab-trees').waitFor();
  assert.equal(await page.locator('.v25-card-tabs [data-v25-card-tab]').count(),3,'Three card views');
  assert.equal(await page.locator('#v25-stand-list').count(),1,'Stand rows visible without wide grid');
  assert(await page.locator('#ce-section-10').isVisible(),'Trees tab shows stand data');
  const boardWidth=await page.locator('.dt-board').evaluate(el=>el.getBoundingClientRect().width);
  assert(boardWidth<=1024,'Tablet card board must not require desktop scaling');
  await page.locator('[data-v25-card-tab="site"]').click();
  assert(await page.locator('#ce-section-1').isVisible(),'Site tab must show Maket1');
  assert(await page.locator('#ce-section-10').isHidden(),'Site tab hides stand grid');
  await page.locator('[data-v25-card-tab="makets"]').click();
  assert(await page.locator('#ce-section-31').isVisible(),'Additional tab must show M31');
  assert(await page.locator('#ce-section-1').isHidden(),'Makets tab hides unrelated site details');
  await page.locator('[data-v25-card-tab="trees"]').click();
  assert(await page.locator('.v25-stand-command #v25-stand-table').isVisible(),'Original table remains accessible');
  await page.locator('#v25-stand-table').click();
  assert(await page.locator('#ce-table-Макет10').isVisible(),'Original table can be opened');
  await page.locator('#ce-cancel').click();
  if(await page.locator('#solin-v23-leave-confirm').isVisible())
    await page.locator('#solin-v23-leave-confirm [data-v23="discard"]').click();
  await page.waitForFunction(()=>!document.querySelector('#ce-form'));
  await page.evaluate(()=>solinWorkflow.editMaket('Макет10',(current._children?.Макет10||[]).length));
  assert(await page.locator('#wfQuickForestType').isVisible(),'Forest characteristic in stand modal');
  assert.equal(await page.locator('#wfQuickDestination').count(),1,'Single additional Maket selector');
  assert.equal(await page.locator('[data-wf-quick-maket]').count(),0,'Remove wall of buttons');
  await page.locator('#wfCompCancel').click();
  if(await page.locator('#solin-v23-leave-confirm').isVisible())
    await page.locator('#solin-v23-leave-confirm [data-v23="discard"]').click();
  await page.evaluate(()=>show('menuScreen'));
  assert.equal(await page.locator('#solin-mdb-export').count(),1,'One MDB export');
  assert.equal(await page.locator('#solin-update-button').count(),1,'One updater button');
  assert.deepEqual(errors,[],'Browser must have no unhandled JavaScript exceptions');
  console.log('V25 CLEAN UI OK: tablet card, tabbed Makets, stand rows, forest type, export and updater preserved.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
