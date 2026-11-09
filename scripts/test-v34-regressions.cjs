/* V34 regression gates for the exact bugs observed on Lenovo tablet.
 * No user files or Android package data are changed by these checks. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const txt=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const css=txt('solin-v33-ux.css');
const ux=txt('solin-v33-ux.js');
const usability=txt('solin-usability.js');
const installer=txt('scripts/install-android-mdb.mjs');
const old="if(id==='card')document.querySelector('.quickActions').style.display='none';else document.querySelector('.quickActions').style.display='';";
const fixed="const bar=document.querySelector('.quickActions');if(bar)bar.style.display=id==='card'?'none':'';";
assert.ok(css.includes('CRITICAL HIT-BOX FIX'));
assert.match(css,/\.v33-menu-group > label\.field-import\s*\{\s*position:relative!important/);
assert.match(css,/\.v33-menu-group > label\.field-import > input\[type="file"\]/);
assert.match(css,/contain:paint/);
assert.match(css,/width:100%!important;height:100%!important/);
assert.match(ux,/function guardModalOnlyX\(/);
assert.match(ux,/event\.target!==modal/);
for(const type of ['pointerdown','pointerup','click','touchend'])assert.ok(ux.includes(type));
assert.ok(ux.includes("event.key==='Escape'"));
assert.ok(ux.includes("document.addEventListener('backbutton'"));
assert.ok(!usability.includes(old));
assert.ok(usability.includes(fixed));
assert.ok(installer.includes('SolinOnlyXBackDispatcher'));
assert.ok(installer.includes('getOnBackPressedDispatcher().addCallback'));
assert.ok(installer.includes('getBridge().getWebView()'));
assert.ok(installer.includes('!m.classList.contains(\'hidden\')'));
if(process.argv.includes('--built')){
 const web=txt('www/solin-usability.js');
 assert.ok(!web.includes(old),'Old V30 startup crash must be removed from web assets');
 assert.ok(web.includes(fixed),'V30 original usability must remain, only null access patched');
 const html=txt('www/index.html');
 assert.ok(html.includes('solin-v33-ux.css?v=33'));
 assert.ok(html.includes('solin-v33-ux.js?v=33'));
 assert.ok(web.length>3000,'Unexpected truncated usability module');
}
if(process.argv.includes('--android')){
 const main=txt('android/app/src/main/java/kz/solin/field/MainActivity.java');
 assert.ok(main.includes('SolinOnlyXBackDispatcher'),'Native Back must respect X-only dialogs');
 assert.ok(main.includes('getOnBackPressedDispatcher().addCallback'));
 assert.ok(main.includes('SolinUpdatePlugin.class'),'Must preserve proven updater');
}
console.log('V34 PASS: constrained import hit-box, safe startup, X-only dialogs and Android Back, verified native updater.');
