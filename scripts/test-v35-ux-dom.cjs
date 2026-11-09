/* V35 browser-DOM interaction regression, exercising actual shipped UI script.
 * This fixture uses real DOM mutation, events and active source-backed fields.
 * Requires jsdom (test-only; never bundled in the APK).
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=`<!doctype html><html><body class="field-shell">
 <section class="screen active" id="mainScreen"><div class="workspace">Меню</div></section>
 <section class="screen" id="quartersScreen"><div class="workspace">Кварталы</div></section>
 <div id="modal" class="modal ce-modal">
  <div class="modalCard"><div id="modalBody">
   <form id="ce-form">
    <section id="ce-section-3">
     <div class="dt-fixed"><span>Главная порода (см. Основные данные)</span><input readonly value=""></div>
     <div class="dt-fixed"><span>Тип леса (см. Основные данные)</span><input readonly value=""></div>
    </section>
    <section id="ce-section-10"><div class="dt-board">
     <div class="dt-cell"><div class="dt-input"><select data-ce-scope="base" data-ce-field="M3Pr">
       <option value="ОС" selected>ОС — Осина</option><option value="Б">Б — Берёза</option>
     </select><output data-ce-display-for="main">Осина</output></div></div>
     <div class="dt-cell"><div class="dt-input"><select data-ce-scope="base" data-ce-field="M3TLU" disabled>
       <option value="">—</option><option value="БРТЗ">БРТЗ — Берёзовый разнотравный</option>
     </select><output data-ce-display-for="type">Выбрать</output></div></div>
     <input data-ce-scope="base" data-ce-field="NE2A" value="">
     <input data-ce-scope="base" data-ce-field="KlxrVD" value="3">
    </div></section>
   </form>
  </div></div>
 </div>
 </body></html>`;
const dom=new JSDOM(html,{url:'https://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
const {window}=dom,document=window.document;
let pickerCalls=[],refreshes=0,groupInputEvents=0;
window.SolinCardAssist={openFieldByKey(field){pickerCalls.push(field);return true;}};
window.SolinCardEditor={refreshDependencies(){refreshes++;}};
window.SolinDependentRules={forestTypes(){return {status:'ambiguous',groups:['0','1'],items:[]};}};
window.SOLIN_REFS={tables:{}};
document.querySelector('[data-ce-field="NE2A"]').addEventListener('change',()=>groupInputEvents++);
window.show=function(id){document.querySelector('.screen.active')?.classList.remove('active');document.getElementById(id)?.classList.add('active');};
window.eval(fs.readFileSync('solin-v35-features.js','utf8'));
document.dispatchEvent(new window.Event('DOMContentLoaded',{bubbles:true}));
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
(async()=>{
 await tick();
 const species=document.querySelector('#ce-section-3 [data-v35-open="M3Pr"]');
 const forest=document.querySelector('#ce-section-3 [data-v35-open="M3TLU"]');
 assert.ok(species&&forest,'Maket 3 must contain two live buttons instead of read-only inputs');
 assert.equal(document.querySelectorAll('#ce-section-3 input[readonly]').length,0,'Grey immutable inputs remain');
 assert.match(species.textContent,/Осина/);
 species.click();
 assert.deepEqual(pickerCalls,['M3Pr'],'Maket3 species button must call the real reference picker');
 forest.click();
 await tick();
 const sheet=document.querySelector('#v35-forest-group-dialog');
 assert.ok(sheet,'Ambiguous real STL groups must open explicit selection');
 assert.equal(sheet.querySelectorAll('.v35-group-item').length,2);
 sheet.click();
 assert.ok(document.querySelector('#v35-forest-group-dialog'),'Backdrop must never dismiss a window');
 sheet.querySelectorAll('.v35-group-item')[1].click();
 await tick();
 assert.equal(document.querySelector('[data-ce-field="NE2A"]').value,'1');
 assert.equal(groupInputEvents,1,'Group must update the existing actual field once');
 assert.equal(refreshes,1,'Dependent types must recalculate after the chosen group');
 assert.equal(pickerCalls.at(-1),'M3TLU','Real forest-type picker must open after group selection');
 assert.ok(!document.querySelector('#v35-forest-group-dialog'));
 document.querySelector('[data-ce-field="M3Pr"]').value='Б';
 document.querySelector('[data-ce-field="M3Pr"]').dispatchEvent(new window.Event('change',{bubbles:true}));
 await tick();
 assert.match(species.textContent,/Берёза/,'Maket 3 mirror must follow edits to original species select');
 window.show('quartersScreen');
 assert.ok(document.getElementById('quartersScreen').classList.contains('v35-screen-in'),
   'Premium screen entrance must run on navigation');
 assert.ok(document.body.classList.contains('v35-premium'));
 console.log('V35_DOM_UI_OK: Maket3 buttons, original species picker, explicit NE2A group, linked M3TLU, X-only group sheet, screen motion.');
 dom.window.close();
})().catch(error=>{console.error(error);dom.window.close();process.exitCode=1;});
