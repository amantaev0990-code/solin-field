/* Regression: readable mobile editor while keeping desktop SOLI-N coordinates. */
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=__dirname;
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]||'/');const file=path.resolve(root,'.'+rel);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end('forbidden');}try{const target=fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(fs.readFileSync(target));}catch{res.writeHead(404);res.end('not found');}});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(8129,'127.0.0.1',r));
 browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TARGET_URL||'http://127.0.0.1:8129/');await page.waitForFunction(()=>window.SolinWorkspace&&window.SOLIN_REFS&&window.SolinHuman);await page.evaluate(()=>SolinWorkspace.ready);
 const snapshot=await page.evaluate(()=>JSON.stringify(SOLIN_REFS.tables));
 await page.evaluate(()=>{show('menuScreen')});assert.equal(await page.locator('#wfMenu').count(),0);assert(!(await page.locator('#menuScreen').innerText()).includes('Функции оригинальной'));assert((await page.locator('#menuScreen').innerText()).includes('Экспорт Transfer'));
 if(process.env.TEST_OUTPUT){fs.mkdirSync(process.env.TEST_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.TEST_OUTPUT,'more.png')});}
 await page.evaluate(()=>{show('refsScreen');renderFriendlyRefs('')});assert(await page.locator('.refCard').count()>30);
 await page.locator('[data-reference="SPV"]>summary').click();await page.locator('[data-reference="SPV"] .human-ref-row').first().waitFor();
 const analysis=await page.locator('[data-reference="SPV"]').innerText();assert(analysis.includes('Макет 15 — Выполненные хозяйственные мероприятия'));assert(analysis.includes('Шифр 1'));assert(!analysis.includes('Служебные параметры'));assert(!analysis.includes('Код '));
 await page.locator('#refsScreen input').fill('Макет 21');assert(await page.locator('[data-reference="SOE"]').count());
 await page.locator('#refsScreen input').fill('сосна');await page.locator('.refCard>summary').first().click();await page.locator('.human-ref-row').first().waitFor();assert(/Сосн/i.test(await page.locator('#friendlyRefs').innerText()));
 await page.locator('#refsScreen input').fill('');await page.evaluate(()=>{for(const d of document.querySelectorAll('.refCard'))d.open=true});await page.waitForFunction(()=>[...document.querySelectorAll('.refCard')].every(d=>d.querySelector('.human-ref-list')));
 const text=await page.locator('#friendlyRefs').innerText();assert(!/служебн|расчётная таблица|Код |NPV|KPV/.test(text));
 assert.equal(await page.evaluate(()=>JSON.stringify(SOLIN_REFS.tables)),snapshot);assert.deepEqual(errors,[]);
 for(const width of [320,390]){await page.setViewportSize({width,height:844});await page.locator('#refsScreen input').fill('Анализ выполнения');await page.locator('[data-reference="SPV"]>summary').click();await page.locator('[data-reference="SPV"] .human-ref-row').first().waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(process.env.TEST_OUTPUT)await page.screenshot({path:path.join(process.env.TEST_OUTPUT,'references-'+width+'.png')});}
 console.log('PASS readable references, actual maket bindings, shifr, no technical rows, menu removal, search, unchanged source data, 320/390px, no JS errors');
 }catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();server.close()}})();
