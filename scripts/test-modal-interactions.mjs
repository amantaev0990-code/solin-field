/* Modal interaction regression in iPhone-sized WebKit.
 * No real stand data is modified: only temporary form controls are tapped.
 */
import assert from 'node:assert/strict';
import {webkit} from 'playwright';

const base=process.env.SOLIN_TEST_URL||'http://127.0.0.1:8765/';
const browser=await webkit.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof openModal==='function'&&typeof updateNewCompQuarter==='function');
 // Standard dialog, header X, Escape and backdrop must not leave a dead overlay.
 await page.evaluate(()=>openModal('Проверка окна','<input id="modalProbe" placeholder="Введите текст"><button id="modalProbeButton">Нажми</button>'));
 await page.locator('#modalProbe').fill('работает');
 assert.equal(await page.locator('#modalProbe').inputValue(),'работает');
 await page.locator('#modal .modalHead .close').click();
 await page.locator('#modal.hidden').waitFor();
 await page.evaluate(()=>openModal('Escape','<input aria-label="escape-test">'));
 await page.keyboard.press('Escape');
 await page.locator('#modal.hidden').waitFor();
 await page.evaluate(()=>openModal('Backdrop','<input aria-label="backdrop-test">'));
 await page.locator('#modal').click({position:{x:2,y:2}});
 await page.locator('#modal.hidden').waitFor();

 // Simulate map/control sheet that used to cover dialogs with z-index 900.
 await page.evaluate(()=>{
  const block=document.createElement('div');
  block.id='modalTestOverlay';block.style.cssText='position:fixed;inset:0;z-index:900;background:#0003';
  document.body.append(block);
  openModal('Z-index regression','<input id="modalOverOverlay" placeholder="Нажатия">');
 });
 await page.locator('#modalOverOverlay').fill('кликается');
 assert.equal(await page.locator('#modalOverOverlay').inputValue(),'кликается');
 await page.locator('#modal .modalHead .close').click();
 await page.evaluate(()=>document.getElementById('modalTestOverlay')?.remove());

 // Changing a quarter must NOT replace the modal / lose typed stand values.
 await page.waitForFunction(()=>typeof D!=='undefined'&&D?.quarters&&Object.keys(D.quarters).length>1);
 await page.evaluate(()=>openCompForm(Object.keys(D.quarters)[0]));
 await page.locator('#newVD').fill('987');
 await page.locator('#newPLV').fill('4.6');
 const before=await page.locator('#modalBody').evaluate(el=>el);
 const ids=await page.locator('#newCompKV option').evaluateAll(opts=>opts.map(x=>x.value));
 assert.ok(ids.length>1);
 await page.locator('#newCompKV').selectOption(ids[1]);
 assert.equal(await page.locator('#newVD').inputValue(),'987','VD must survive iOS native quarter picker');
 assert.equal(await page.locator('#newPLV').inputValue(),'4.6','Area must survive quarter change');
 await page.locator('#newVD').fill('988');
 assert.equal(await page.locator('#newVD').inputValue(),'988');
 const changed=await page.locator('#newCompKGLF option').count();
 assert.ok(changed>=1,'KGLF options must update for the selected quarter');
 await page.locator('#modal .modalHead .close').click();
 await page.locator('#modal.hidden').waitFor();
 assert.ok(!errors.length,'Browser errors: '+errors.join('; '));
 console.log('MODALS_WEBKIT_OK: native quarter selector, typing, header X, Escape, backdrop, and higher stacking');
 await context.close();
}finally{await browser.close();}
