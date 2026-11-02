'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),port=Number(process.env.TEST_PORT||8143),prefix='solin_field_card_draft_v1:';
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}try{const p=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end();}});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const base=f=>page.locator('[data-ce-scope="base"][data-ce-field="'+f+'"]');
 const ready=()=>page.waitForFunction(()=>window.SolinWorkspace&&window.SolinCardEditor&&window.SOLIN_REFS).then(()=>page.evaluate(()=>SolinWorkspace.ready));
 await page.goto('http://127.0.0.1:'+port+'/');await ready();
 const address=await page.evaluate(async()=>{const f=(await SolinWorkspace.list())[0];await SolinWorkspace.activate(f.id);current=Object.values(D.quarters).flatMap(q=>q.compartments).find(r=>r.PLV>0&&r._children?.Макет10?.length);renderComp();show('card');return Object.fromEntries(['POS','LESN','KV','KGLF','VD'].map(k=>[k,current[k]]));});
 const open=()=>page.evaluate(address=>{current=D.quarters[address.KV].compartments.find(r=>Object.keys(address).every(k=>String(r[k])===String(address[k])));renderComp();show('card');SolinCardEditor.open(current);},address);
 const stored=()=>page.evaluate(prefix=>Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>JSON.parse(localStorage.getItem(k))),prefix);
 await open();const originalArea=await page.evaluate(()=>current.PLV);
 await base('PLV').fill('23,75');
 await base('VNUM').fill('7000');await base('VNUM').dispatchEvent('change');
 await page.locator('[data-ce-extra="Макет23"]').click();
 await page.locator('[data-ce-scope="Макет23"][data-ce-field="K1"]').first().selectOption('2');
 // Mobile pagehide must flush the latest edit, including a newly created child row.
 await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 assert.equal((await stored()).length,1);
 assert.notEqual(await page.evaluate(()=>current.PLV),23.75,'autosave must not commit the actual card');
 await page.reload();await ready();
 if(process.env.TEST_OUTPUT){fs.mkdirSync(process.env.TEST_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.TEST_OUTPUT,'home-draft.png')});}
 await page.locator('#ce-home-drafts [data-ce-resume]').first().click();
 await page.locator('[data-ce-recover]').waitFor();
 if(process.env.TEST_OUTPUT)await page.screenshot({path:path.join(process.env.TEST_OUTPUT,'resume-draft.png')});
 assert(await page.locator('.dt-viewport').evaluate(el=>el.inert));
 for(const size of [{width:320,height:500},{width:390,height:500},{width:700,height:844}]){
  await page.setViewportSize(size);await page.locator('[data-ce-draft-discard]').scrollIntoViewIfNeeded();
  assert(await page.locator('[data-ce-draft-discard]').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-ce-recover]').click();
 assert.equal(await base('PLV').inputValue(),'23,75');
 assert.match(await page.locator('#ce-entry-checks').innerText(),/ВНУМ превышает/);
 await page.locator('[data-ce-extra="Макет23"]').click();
 assert.equal(await page.locator('[data-ce-scope="Макет23"][data-ce-field="K1"]').first().inputValue(),'2');
 await page.locator('#ce-cancel').click();
 assert.equal((await stored()).length,0,'explicit Cancel must remove the recovered draft');
 assert.equal(await page.evaluate(()=>current.PLV),originalArea);

 // Fast input writes to the same draft immediately, and Back keeps typed values.
 await open();await page.locator('[data-ce-assist-sequence]').click();
 await page.locator('#ce-assist-value').fill('21,25');
 assert.equal(await base('PLV').inputValue(),'21,25');
 await page.locator('[data-ce-assist-apply]').click();
 assert(await page.locator('#ce-assist-options').isVisible());
 const category=await base('KU').inputValue();await page.locator('#ce-assist-query').press('Enter');assert.equal(await base('KU').inputValue(),category);
 await page.locator('#ce-assist-query').fill(category);await page.locator('#ce-assist-query').press('Enter');
 assert.equal(await base('KU').inputValue(),category);assert.doesNotMatch(await page.locator('.ce-assist-head').innerText(),/Категория угодий/);
 await page.locator('[data-ce-assist-back]').click();
 await page.locator('[data-ce-assist-back]').last().click();
 assert.equal(await page.locator('#ce-assist-value').inputValue(),'21,25');
 await page.locator('[data-ce-assist-close]').click();
 await page.locator('#ce-save').click();
 assert.equal(await page.evaluate(()=>current.PLV),21.25);
 assert.equal((await stored()).length,0,'successful Save must remove the draft');
 await page.reload();await ready();
 await page.evaluate(async()=>{const f=(await SolinWorkspace.list())[0];await SolinWorkspace.activate(f.id);});await open();
 assert.equal(await base('PLV').inputValue(),'21,25');assert.equal(await page.locator('.ce-recovery').count(),0);

 // Invalid text survives reload and continues to block saving until corrected.
 await base('PLV').fill('abc');await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 await page.reload();await ready();await page.locator('#ce-home-drafts [data-ce-resume]').first().click();await page.locator('[data-ce-recover]').click();
 assert.equal(await base('PLV').inputValue(),'abc');assert.equal(await base('PLV').getAttribute('aria-invalid'),'true');
 await page.locator('#ce-save').click();assert(await page.locator('#ce-form').isVisible());
 await base('PLV').fill('21,25');await page.locator('#ce-cancel').click();assert.equal((await stored()).length,0);

 // A stale draft cannot silently overwrite a newer saved card.
 await open();await base('PLV').fill('31,5');await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 await page.reload();await ready();await page.evaluate(async()=>{const f=(await SolinWorkspace.list())[0];await SolinWorkspace.activate(f.id);});
 await page.evaluate(address=>{const r=D.quarters[address.KV].compartments.find(r=>Object.keys(address).every(k=>String(r[k])===String(address[k])));r.PLV=41.5;},address);
 await open();assert.equal(await page.locator('[data-ce-recover]').count(),0);assert.match(await page.locator('.ce-recovery').innerText(),/изменилась/);
 const downloadEvent=page.waitForEvent('download');await page.locator('[data-ce-draft-copy]').click();const download=await downloadEvent;
 const copy=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(copy.draft.PLV,31.5);assert.equal(await page.evaluate(()=>current.PLV),41.5);
 await page.locator('[data-ce-draft-discard]').click();assert(!(await page.locator('.dt-viewport').evaluate(el=>el.inert)));
 await page.locator('#ce-cancel').click();

 // Drafts are keyed by the full address, including category and forestry.
 await open();await base('PLV').fill('51,5');await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 await page.reload();await ready();await page.evaluate(async()=>{const f=(await SolinWorkspace.list())[0];await SolinWorkspace.activate(f.id);});
 await page.evaluate(address=>{const other=Object.values(D.quarters).flatMap(q=>q.compartments).find(r=>r.PLV>0&&Object.keys(address).some(k=>String(r[k])!==String(address[k])));SolinCardEditor.open(other);},address);
 assert.equal(await page.locator('.ce-recovery').count(),0);await page.locator('#ce-cancel').click();assert.equal((await stored()).length,1);
 // Clear only this test draft explicitly before testing a new card.
 await page.evaluate(prefix=>{for(const k of Object.keys(localStorage))if(k.startsWith(prefix))localStorage.removeItem(k);},prefix);
 await open();await page.locator('[data-ce-new]').click();
 const newTemplate=await page.evaluate(()=>{const r=JSON.parse(JSON.stringify(current));r.VD=Math.max(...D.quarters[r.KV].compartments.filter(x=>String(x.KGLF)===String(r.KGLF)).map(x=>Number(x.VD)||0))+1;r.PLV=1;r.KU=null;r._children={};r._local=true;return r;});
 await base('KU').selectOption('1');await page.locator('[data-ce-add="Макет10"]').click();
 await page.locator('[data-ce-scope="Макет10"][data-ce-field="KOEF"]').first().fill('10');
 await page.evaluate(()=>dispatchEvent(new Event('pagehide')));await page.reload();await ready();
 await page.locator('#ce-home-drafts [data-ce-resume]').first().click();await page.locator('[data-ce-recover]').click();
 assert.equal(await base('VD').inputValue(),String(newTemplate.VD));
 await page.locator('#ce-save').click();assert.match(await page.locator('#ce-error').innerText(),/породу и ярус/);
 await page.locator('#ce-cancel').click();assert.equal((await stored()).length,0);
 // Walking untouched fields must not create a blank stand row or turn zeros into null.
 await page.evaluate(template=>SolinCardEditor.open(template,{isNew:true}),newTemplate);
 await base('KU').selectOption('22');await page.locator('[data-ce-assist-sequence]').click();
 let steps=0;while(!await page.locator('.ce-assist-complete').count()&&steps++<130)await page.locator('[data-ce-assist-apply]').click();
 assert(await page.locator('.ce-assist-complete').isVisible(),'sequence must reach the completion screen');
 if(process.env.TEST_OUTPUT){fs.mkdirSync(process.env.TEST_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.TEST_OUTPUT,'quick-complete.png')});}
 await page.locator('[data-ce-assist-new]').click();
 const savedNew=await page.evaluate(vd=>D.quarters[current.KV].compartments.find(r=>String(r.VD)===String(vd)&&String(r.KGLF)===String(current.KGLF)),newTemplate.VD);
 assert(savedNew);assert.equal(String(savedNew.KU),'22');assert.equal(savedNew._children?.Макет10?.length||0,0);
 assert.equal(await base('PLV').inputValue(),'1');assert.equal(await base('KU').inputValue(),'');
 await page.locator('#ce-cancel').click();
 // Failure of the draft store is visible and does not prevent normal card saving.
 await open();await page.evaluate(prefix=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith(prefix))throw new DOMException('Full','QuotaExceededError');return original.call(this,k,v);};},prefix);
 await base('PLV').fill('73,25');await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 assert.match(await page.locator('#ce-status').innerText(),/Не удалось записать черновик/);
 await page.locator('#ce-save').click();assert.equal(await page.evaluate(()=>current.PLV),73.25);
 await page.reload();await ready();await page.evaluate(async()=>{const f=(await SolinWorkspace.list())[0];await SolinWorkspace.activate(f.id);});
 // Two tabs must not overwrite or delete each other's newer draft.
 await open();await base('PLV').fill('81');await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 const second=await page.context().newPage();second.on('pageerror',e=>errors.push(e.message));second.on('dialog',d=>d.accept());
 await second.goto('http://127.0.0.1:'+port+'/');await second.waitForFunction(()=>window.SolinWorkspace&&window.SolinCardEditor&&window.SOLIN_REFS);await second.evaluate(()=>SolinWorkspace.ready);
 await second.locator('#ce-home-drafts [data-ce-resume]').first().click();await second.locator('[data-ce-recover]').click();
 await second.locator('[data-ce-scope="base"][data-ce-field="PLV"]').fill('82');await second.evaluate(()=>dispatchEvent(new Event('pagehide')));
 await base('PLV').fill('83');await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
 assert.match(await page.locator('#ce-status').innerText(),/другой вкладке/);assert.equal((await stored())[0].draft.PLV,82);
 await page.locator('#ce-cancel').click();assert.equal((await stored()).length,1);
 await second.locator('#ce-cancel').click();assert.equal((await stored()).length,0);await second.close();
 assert.deepEqual(errors,[]);console.log('PASS reload/pagehide, home resume, child rows, invalid text, Cancel/Save, stale draft download, address isolation, new-card validation, quick input Back');
}catch(err){console.error(err);process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));}})();
