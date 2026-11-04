/* Android WebView behavior regression through Chromium's native-platform shim.
 * Verify both ordinary dropdowns and the old Access-style card use real
 * searchable keyboard inputs, without changing original MDB field values. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),port=8177;
const server=http.createServer((req,res)=>{
 try{const relative=decodeURIComponent(req.url.split('?')[0]),file=path.resolve(root,'.'+relative);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const p=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
  res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':p.endsWith('.wasm')?'application/wasm':'application/octet-stream');
  res.end(fs.readFileSync(p));
 }catch{res.writeHead(404);res.end();}
});
(async()=>{
 let browser;
 try{
  await new Promise(done=>server.listen(port,'127.0.0.1',done));
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:960,height:800},hasTouch:true,isMobile:true});
  await context.addInitScript(()=>{window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',Plugins:{}};});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',x=>errors.push(x.message));
  await page.goto('http://127.0.0.1:'+port+'/');
  await page.waitForFunction(()=>window.SolinWorkspace&&window.SolinAndroidSelects&&window.SolinCardAssist);
  await page.evaluate(()=>SolinWorkspace.ready);
  const fixture=await page.evaluate(async()=>{
   const forest=(await SolinWorkspace.list())[0];await SolinWorkspace.activate(forest.id);
   const k=Object.keys(D.quarters).find(x=>D.quarters[x]?.compartments?.length);
   if(!k)throw Error('No stand fixture');
   openCompForm(k);
   return {k};
  });
  assert(await page.locator('#newKU').isVisible(),'Native stand form KU select visible');
  const candidate=await page.locator('#newKU').evaluate(el=>[...el.options].find(x=>x.value&&!x.disabled)?.value);
  assert(candidate,'Source-backed KU code must be offered to Android user');
  await page.locator('#newKU').tap({force:true});
  assert(await page.locator('#sap-search').isVisible(),'Android opens custom searchable selector after a completed tap');
  await page.waitForTimeout(120);
  assert(await page.locator('#sap-search').isVisible(),'Picker must stay open after touchend/click (no flash-and-close regression)');
  assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'sap-search','Picker must not open keyboard automatically');
  await page.locator('#sap-search').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'sap-search','Explicit search tap focuses keyboard input');
  await page.locator('#sap-search').fill(candidate);
  assert(await page.locator('#sap-options button').count()>=1);
  await page.locator('#sap-options button').filter({hasText:candidate}).first().click();
  assert.equal(await page.locator('#newKU').inputValue(),candidate,'Picker keeps original MDB value');
  assert.equal(await page.locator('#solin-android-picker').count(),0,'Picker must clean up after choice');
  await page.evaluate(()=>{
   closeModal();const k=Object.keys(D.quarters).find(x=>D.quarters[x]?.compartments?.length);
   current=D.quarters[k].compartments[0];renderComp();SolinCardEditor.open(current);
  });
  await page.locator('#ce-form').waitFor();
  assert(await page.locator('#ce-form').isVisible());
  assert(await page.locator('.ce-assist-shortcuts').isVisible(),
    'Large Android tablet must show field and Maket edit shortcuts');
  assert(await page.locator('.ce-mobile-tabs').isVisible(),
    'Large Android tablet must show Maket shortcut tabs');
  const originalArea=await page.evaluate(()=>current.PLV);
  const area=page.locator('#ce-form input[data-ce-scope="base"][data-ce-field="PLV"]').first();
  assert(await area.isVisible(),'Area input must remain reachable');
  await area.dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true});
  assert(await page.locator('#ce-assist-value').isVisible(),
    'Tapping a numeric cell on Android opens the full-size editor');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'ce-assist-value',
    'Numeric field focuses an actual editable input for Android keyboard');
  await page.locator('#ce-assist-value').fill(String(Number(originalArea||1)+.5));
  await page.locator('[data-ce-assist-apply]').click();
  assert.equal(await page.evaluate(()=>current.PLV),originalArea,
    'Editing numeric field must remain a draft until the tax card is saved');
  const native=await page.evaluate(()=>({
   isAndroid:window.Capacitor.isNativePlatform(),
   enabled:[...document.querySelectorAll('.dt-board select[data-ce-field]')].filter(x=>!x.disabled&&x.getBoundingClientRect().width>20).map(x=>x.id)
  }));
  assert(native.enabled.length,'Original card must have enabled choices');
  const selector='#'+native.enabled[0];
  await page.locator(selector).click({force:true});
  assert(await page.locator('#ce-assist-query').isVisible(),'Desktop-sized Android tablet must use searchable card assistant');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'ce-assist-query','Card assistant must focus Android keyboard');
  assert.equal(await page.locator('#solin-android-picker').count(),0,'No double modal in desktop card');
  // A grey dependent input is not a valid selectable code. It must explain
  // the actual prerequisite instead of offering unsafe options.
  await page.evaluate(()=>{
   document.querySelector('#ce-assist [data-ce-assist-close]')?.click();
   const el=document.querySelector('#ce-form [data-ce-scope="base"][data-ce-field="KU"]');
   el.disabled=true;
   el.title='Требуется исходный справочник SKU (проверка)';
   SolinCardAssist.openFieldPicker();
  });
  await page.locator('#ce-assist-options [data-ce-assist-pick]').filter({hasText:'KU'}).first().click();
  assert.match(await page.locator('#ce-assist').innerText(),/Требуется исходный справочник SKU/,
   'Disabled dependent field should explain missing source rather than let a code through');
  assert.equal(await page.locator('#ce-assist-options [data-ce-assist-option]').count(),0,
   'Disabled field must not offer invalid selectable values');
  await page.locator('#ce-assist [data-ce-assist-close]').first().click();

  assert.deepEqual(errors,[],'No JS errors in Android-select interactions');
  console.log('ANDROID_SELECTS_OK: 960px Android tablet shows maket tabs, keyboard focus for code and numeric fields, source-code preservation, draft safety with grey fields explicitly explained; no double dialogs');
 }finally{await browser?.close();await new Promise(done=>server.close(done));}
})().catch(e=>{console.error(e);process.exitCode=1;});
