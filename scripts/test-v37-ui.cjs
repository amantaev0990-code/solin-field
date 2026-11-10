/* V37 acceptance tests — five requirements and non-destructive creation.
 * Source-only tests need Node; --built uses jsdom already installed by V35.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const ui=read('solin-v37-ui.js'),css=read('solin-v37-ui.css');
const native=read('scripts/install-android-mdb.mjs');
const sourceApp=read('app.js');
new Function(ui);
assert.match(css,/html:not\(\.v37-menu-ready\)/);
assert.match(css,/#modal\.ce-modal #ce-section-10 \.ce-v23-species/);
assert.match(css,/#card \.v37-new-stand-button/);
assert.match(css,/background:#bd1f32/);
assert.ok(ui.includes("const menuTitle='Главное меню'"));
assert.ok(ui.includes('function navigationBack()'));
assert.ok(ui.includes('if(modalActive())return'));
assert.ok(ui.includes("window.SolinV37={back:navigationBack"));
assert.ok(ui.includes("window.openCompForm(k,cat)"));
assert.ok(ui.includes("quarter?.compartments?.includes(record)"));
assert.ok(!native.includes('passToSystem()'));
assert.ok(native.includes('SolinOnlyXBackDispatcher'));
assert.ok(native.includes('window.SolinV37.back()'));
assert.ok(native.includes('if (w == null) return;'));
assert.ok(!native.includes('getOnBackPressedDispatcher().onBackPressed()'));
assert.ok(sourceApp.includes('const known=(quarter.compartments||[]).find('));
assert.ok(sourceApp.includes('const existing=quarter.compartments||[];'));
if(process.argv.includes('--built')){
 const html=read('www/index.html'),built=read('www/app.js');
 assert.ok(html.includes('id="solin-v37-startup"'));
 assert.ok(html.includes('solin-v37-ui.css?v=37'));
 assert.ok(html.includes('solin-v37-ui.js?v=37'));
 assert.ok(html.indexOf('id="solin-v37-startup"')<html.indexOf('</head>'));
 assert.ok(html.indexOf('solin-v37-ui.js?v=37')>html.indexOf('solin-v35-features.js?v=35'));
 assert.ok(built.includes('const existing=quarter.compartments||[];'));
 assert.ok(built.includes('const known=(quarter.compartments||[]).find('));
 assert.ok(html.includes('solin-updates.js?v=36-github-retry'));
 for(const f of ['www/solin-v37-ui.js','www/solin-v37-ui.css',
 'www/solin-v35-features.js','www/solin-v35-motion.css',
 'www/maps/213-1.cmf2','www/maps/213-2.cmf2'])
  assert.ok(fs.existsSync(f),'Missing critical asset: '+f);
 // Test the real create-stand function without loading the whole app.
 const start=built.indexOf('function openCompForm(');
 const end=built.indexOf('// The native iOS',start);
 assert.ok(start>=0&&end>start,'Could not isolate actual stand creation handler');
 const own={KV:12,VD:5,KGLF:3,POS:213,LESN:2,PLV:1,_children:{}};
 const other={KV:12,VD:8,KGLF:5,POS:213,LESN:2,PLV:1,_children:{}};
 const quarter={quarterRows:[{KGLF:5,Klxr:7,Fzona:1}],compartments:[own,other]};
 const db={quarters:{'12':quarter},lesnichestvo:[{POS:213,LESN:2}],
  transfSchema:{'Выдел':['POS','LESN','KV','KGLF','VD','PLV','KU','M3Pr']}};
 let created=null,shown='';
 const context={
   D:db,current:own,window:{SolinAddressContext:{enrichStand(){}},SolinCardEditor:{open(){} }},
   renderComp(){},show(id){shown=id;},toast(m){throw Error(m);},
   document:{querySelector(q){return q==='#humanContent'?{prepend(){}}:null;},
     createElement(){return {setAttribute(){},textContent:'',className:''};}},
 };
 vm.createContext(context);
 vm.runInContext(built.slice(start,end),context);
 const before=JSON.stringify(quarter.compartments);
 context.openCompForm('12',3);
 created=context.current;
 assert.ok(created&&created!==own,'New must NOT be existing stand');
 assert.equal(created.VD,9,'New number must be unique across quarter KGLF');
 assert.equal(created.KGLF,3,'New must inherit currently opened stand category');
 assert.equal(created.POS,213);assert.equal(created.LESN,2);
 assert.equal(created.PLV,1);assert.equal(created._local,true);
 assert.equal(JSON.stringify(quarter.compartments),before,
   'The new stand must stay unsaved until the editor Save succeeds');
 assert.equal(shown,'card');
 // DOM test of actual click hitboxes, Android route stack and modal guard.
 const {JSDOM}=require('jsdom');
 const dom=new JSDOM('<!doctype html><html><body><section class="screen active" id="mainScreen">'+
   '<div class="workspace"><h2>Головное меню</h2><div class="v33-main-layout"></div></div></section>'+
   '<section class="screen" id="quartersScreen"><div class="workspace"></div></section>'+
   '<section class="screen" id="card"><div class="workspace"><div id="childContent"></div></div></section>'+
   '<div id="modal" class="modal hidden"></div></body></html>',{
   url:'https://localhost/',runScripts:'outside-only',pretendToBeVisual:true
 });
 const {window}=dom,document=window.document;
 window.__v37Fixtures={db,stand:own};
 window.eval('let D=window.__v37Fixtures.db;let current=window.__v37Fixtures.stand;');
 const calls=[];
 window.openCompForm=(k,kglf)=>calls.push({k,kglf});
 window.show=id=>{
  document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
 };
 window.renderComp=()=>{};
 window.toast=m=>{throw Error('Unexpected toast: '+m);};
 window.eval(ui);
 document.dispatchEvent(new window.Event('DOMContentLoaded',{bubbles:true}));
 assert.ok(document.documentElement.classList.contains('v37-menu-ready'),
  'Startup may only reveal after new menu layout appears');
 assert.equal(document.querySelector('#mainScreen h2').textContent,'Главное меню');
 window.show('quartersScreen');window.show('card');
 const btn=document.getElementById('solin-v37-new-button');
 assert.ok(btn,'Red New footer is absent from open stand');
 assert.equal(btn.disabled,false);
 btn.click();
 assert.equal(calls.length,1);assert.equal(calls[0].k,'12');
 assert.equal(calls[0].kglf,3);
 assert.equal(JSON.stringify(quarter.compartments),before);
 const dialog=document.getElementById('modal');
 dialog.classList.remove('hidden');
 assert.equal(window.SolinV37.back(),'blocked-dialog','Back must never close dialog');
 assert.equal(document.querySelector('.screen.active').id,'card');
 dialog.classList.add('hidden');
 assert.equal(window.SolinV37.back(),'navigated','Android Back must return to previous screen');
 assert.equal(document.querySelector('.screen.active').id,'quartersScreen');
 assert.equal(window.SolinV37.back(),'navigated','Second Back must navigate to menu');
 assert.equal(document.querySelector('.screen.active').id,'mainScreen');
 assert.equal(window.SolinV37.back(),'blocked-root','Back at root must not exit');
 const newPreview={...own,VD:9};
 window.eval('current={KV:12,VD:9,KGLF:3,POS:213,LESN:2,_local:true};');
 window.SolinV37.refresh();
 assert.equal(btn.disabled,true,'A second New must not be available on an unsaved stand');
 dom.window.close();
}
if(process.argv.includes('--android')){
 const java=read('android/app/src/main/java/kz/solin/field/MainActivity.java');
 assert.ok(java.includes('window.SolinV37.back()'));
 assert.ok(!java.includes('passToSystem()'));
 assert.ok(java.includes('registerPlugin(SolinUpdatePlugin.class)'),
  'Proven updater plugin must remain');
}
console.log('V37 PASS: startup without old menu; correct heading; Android Back stays inside app; no visible duplicate species; unique unsaved New stand.');
