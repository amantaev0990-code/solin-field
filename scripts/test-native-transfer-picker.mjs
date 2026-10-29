/* iPhone-sized WebKit regression: a direct tap must open the native
 * file chooser, and selecting a broken MDB must surface a clear error.
 * No real forestry data is imported or overwritten. */
import assert from 'node:assert/strict';
import { webkit } from 'playwright';
const base=process.env.SOLIN_TEST_URL||'http://127.0.0.1:8765/';
const browser=await webkit.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.SolinWorkspace?.ready!==undefined);
 await page.evaluate(()=>window.SolinWorkspace.ready);
 const picker=page.locator('#transferForestInput');
 assert.equal(await picker.getAttribute('type'),'file');
 assert.equal(await picker.getAttribute('hidden'),null);
 assert.equal(await picker.getAttribute('accept'),null);
 const layout=await picker.evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,opacity:getComputedStyle(el).opacity};});
 assert.ok(layout.width>100&&layout.height>40,'Native input must physically cover the visual button');
 assert.equal(Number(layout.opacity),0,'Native chooser must be invisible; only the green button is visible');
 assert.equal(await picker.evaluate(el=>getComputedStyle(el).pointerEvents),'auto','The invisible native picker must remain tappable');
 assert.equal(await page.locator('#importForestButton').textContent().then(t=>t.trim()),'↓ Загрузить Transfer','Keep the previous one-button design');
 const chosen=page.waitForEvent('filechooser',{timeout:15000});
 await page.locator('.transfer-file-picker').click({position:{x:32,y:20}});
 const chooser=await chosen;
 assert.equal(chooser.isMultiple(),false);
 await chooser.setFiles({name:'Transf_213_2_2026.mdb',mimeType:'application/octet-stream',buffer:Buffer.from('not a valid Jet database')});
 await page.waitForFunction(()=>document.querySelector('#modalTitle')?.textContent.includes('Не удалось загрузить Transfer'),{timeout:30000});
 assert.match(await page.locator('#modalBody').innerText(),/MDB|Access|Transfer/i);
 // Selecting the same file again must work after an error.
 await page.evaluate(()=>window.closeModal());
 const again=page.waitForEvent('filechooser',{timeout:15000});
 await page.locator('.transfer-file-picker').click({position:{x:32,y:20}});
 const repeat=await again;
 await repeat.setFiles({name:'Transf_213_2_2026.mdb',mimeType:'application/octet-stream',buffer:Buffer.from('not a valid Jet database')});
 await page.waitForFunction(()=>document.querySelector('#modalTitle')?.textContent.includes('Не удалось загрузить Transfer'));
 const list=await page.evaluate(()=>window.SolinWorkspace.list());
 assert.ok(Array.isArray(list)&&list.length>=1,'Existing forest list stays available');
 console.log('NATIVE_TRANSFER_PICKER_OK: iPhone tap, file choice, explicit invalid-MDB error, no replacement');
 await context.close();
}finally{await browser.close();}
