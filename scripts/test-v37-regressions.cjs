/* V37 regression gate: cold-start flash, Back, only-X dialogs, source
 * control uniqueness and creation in the currently opened quarter.
 * Runs offline against actual new UI script and the signed-build assets.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(f,'utf8');
const code=read('solin-v37-fixes.js');
new Function(code);
const nativeInstaller=read('scripts/install-android-mdb.mjs');
assert.ok(nativeInstaller.includes('SolinV37Navigation.handleBack()'),
 'Android Back must delegate to internal V37 routing');
assert.ok(nativeInstaller.includes('if (w == null) return;'),
 'Back while loading must be consumed');
assert.ok(!nativeInstaller.includes('passToSystem()'),
 'Android may not finish on Back');
if(process.argv.includes('--built')){
 const html=read('www/index.html');
 const editor=read('www/solin-card-editor.js');
 const v35=read('www/solin-v35-features.js');
 const v37js=read('www/solin-v37-fixes.js');
 const sources=fs.readdirSync('www').filter(f=>/\.(js|html|css)$/i.test(f));
 assert.ok(html.indexOf('v37-boot-style')>0 &&
  html.indexOf('v37-boot-style')<html.indexOf('<div class="app">'),
 'Startup splash must hide original UI before the app is rendered');
 assert.ok(html.includes('id="v37-splash"'));
 assert.ok(html.includes('solin-v37-fixes.js?v=37'));
 assert.ok(html.includes('solin-v37-fixes.css?v=37'));
 for(const name of sources){
   assert.ok(!/головное меню/i.test(read('www/'+name)),
    'Old menu spelling still appears in '+name);
 }
 const maket3=editor.slice(editor.indexOf("maket('3',"),editor.indexOf("maket('4',"));
 assert.ok(maket3.includes("cell('M3Pr',r.M3Pr"));
 assert.ok(maket3.includes("cell('M3TLU',r.M3TLU"));
 assert.equal((maket3.match(/cell\('M3Pr'/g)||[]).length,1);
 assert.equal((maket3.match(/cell\('M3TLU'/g)||[]).length,1);
 const stand=editor.slice(editor.indexOf("id=\"ce-section-10\""),editor.indexOf("maket('31',"));
 assert.ok(!stand.includes("cell('M3Pr'"));
 assert.ok(!stand.includes("cell('M3TLU'"));
 assert.ok(!stand.includes('ce-v23-species'));
 assert.ok(v35.includes("'#ce-form [data-ce-scope="),
 'V35 dependent popup must locate moved Maket 3 source fields');
 assert.ok(v37js.includes('window.SolinV37Navigation'));
}
const html=`<!doctype html><html><body>
 <div id="v37-splash"><span data-v37-status>loading</span></div>
 <div class="app">
  <section id="mainScreen" class="screen active"><div class="workspace"><div class="v33-main-layout"></div></div></section>
  <section id="quartersScreen" class="screen"><div class="workspace"></div></section>
  <section id="card" class="screen"><div class="workspace"><div id="childContent"></div></div></section>
  <section id="homeScreen" class="screen"><div class="workspace"></div></section>
  <div id="modal" class="modal hidden"></div>
 </div></body></html>`;
const dom=new JSDOM(html,{url:'https://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
const {window}=dom,document=window.document;
const quarterRecord={KV:213,KGLF:7,VD:1,POS:213,LESN:2,_children:{Макет10:[{POR:'ОС',ZAP:100}]}};
const quarter={compartments:[quarterRecord],meta:{KGLF:7}};
const database={quarters:{213:quarter}};
let standArgs=[],toastMessages=[],created=0;
window.eval('var current = '+JSON.stringify(quarterRecord)+'; var D = '+JSON.stringify(database)+';');
window.eval('current=D.quarters["213"].compartments[0];');
window.show=function(id){
 document.querySelector('.screen.active')?.classList.remove('active');
 document.getElementById(id)?.classList.add('active');
};
window.toast=m=>toastMessages.push(String(m));
window.openCompForm=function(k,glf){standArgs.push([k,glf]);created++;};
window.eval(code);
document.dispatchEvent(new window.Event('DOMContentLoaded',{bubbles:true}));
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
(async()=>{
 await tick();
 assert.ok(document.documentElement.classList.contains('v37-ready'));
 assert.equal(document.getElementById('v37-splash'),null);
 const btn=document.getElementById('v37-new-stand');
 assert.ok(btn);assert.equal(btn.textContent,'＋ Новая');
 window.show('quartersScreen');window.show('card');
 assert.equal(window.SolinV37Navigation.current,'card');
 assert.equal(window.SolinV37Navigation.handleBack(),true);
 assert.equal(window.SolinV37Navigation.current,'quartersScreen');
 assert.equal(window.SolinV37Navigation.handleBack(),true);
 assert.equal(window.SolinV37Navigation.current,'mainScreen');
 assert.equal(window.SolinV37Navigation.handleBack(),true,'Root Back is always consumed');
 assert.equal(window.SolinV37Navigation.current,'mainScreen','Root Back cannot exit');
 window.show('card');
 document.getElementById('modal').classList.remove('hidden');
 window.SolinV37Navigation.handleBack();
 assert.equal(window.SolinV37Navigation.current,'card','Back cannot dismiss modal');
 assert.ok(!document.getElementById('modal').classList.contains('hidden'));
 document.getElementById('modal').classList.add('hidden');
 btn.click();
 assert.deepEqual(standArgs,[['213',7]],'Must open original form in exact quarter/KGLF');
 assert.equal(quarter.compartments.length,1,'Button never saves or copies a record');
 assert.equal(quarterRecord._children.Макет10.length,1,'Old Makets unchanged');
 // Unsaved stand should not open another blank preview.
 window.eval('current={KV:213,KGLF:7,VD:2,POS:213,LESN:2,_children:{}};');
 btn.click();
 assert.equal(created,1,'Do not abandon an unsaved stand by clicking New twice');
 assert.match(toastMessages.join(' '),/Сначала сохраните/);
 console.log('V37 DOM PASS: no old menu flash, internal Android Back, X-only modal, red New existing-quarter action, no data writes.');
 dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
