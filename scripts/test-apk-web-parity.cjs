/* Parity gate: Android Capacitor www contains the SAME functional code and
 * HTML as the GitHub Pages PWA, except the native bridge and disabled SW.
 * No stale Flutter app, no deleted form logic, no replaced offline data. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'www');
const read=(dir,p)=>fs.readFileSync(path.join(dir,p),'utf8');
const sourceHTML=read(root,'index.html'),androidHTML=read(out,'index.html');
const sourceApp=read(root,'app.js'),nativeApp=read(out,'app.js');
const bridge='<script src="solin-apk-mdb.js"></script>';
const expectedHTML=sourceHTML.includes('solin-apk-mdb.js')?sourceHTML:
 sourceHTML.replace('</body>',bridge+'</body>');
assert.equal(androidHTML,expectedHTML,'APK HTML MUST match exactly the approved GitHub Pages UI; only optional native bridge may be added.');
const swCall="if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});";
const nativeSwCall="if(!window.Capacitor?.isNativePlatform?.() && 'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});";
assert(sourceApp.includes(swCall),'Expected current app.js service worker initialization; review build script if changed.');
assert.equal(nativeApp,sourceApp.replace(swCall,nativeSwCall),
 'APK runtime app.js MUST be byte-identical apart from disabling SW in native WebView.');
// Check every same-origin HTML asset. Never silently ship an obsolete CSS,
// JavaScript or raster library even if its name/version was preserved.
const refs=[...sourceHTML.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1].split('?')[0])
 .filter(x=>x&&!x.startsWith('#')&&!/^(?:https?:|data:|\/\/)/.test(x));
let verified=0;
for(const rel of new Set(refs)){
 const original=path.join(root,rel),staged=path.join(out,rel);
 assert(fs.existsSync(original),'The web UI itself references a missing asset '+rel);
 assert(fs.existsSync(staged),'The APK is missing an essential PWA asset '+rel);
 if(rel!=='app.js')assert.deepEqual(fs.readFileSync(staged),fs.readFileSync(original),
  'APK asset differs from its PWA counterpart: '+rel);
 // app.js is checked exactly against the approved native-only SW adaptation above.
 verified++;
}
const required=[
 'solin-workflow.js','solin-card-editor.js','solin-card-calculations.js',
 'solin-quarter-pickers.js','solin-workspace.js','solin-species-entry.js',
 'solin-offline-imagery.js','solin-dependent-rules.js','solin-readable.js',
 'solin-mdb-bridge.js','solin-apk-mdb.js',
 'data-meta.json','data-manifest.json','refs-audit.json.gz',
 'vendor/leaflet.js','vendor/geopackage.min.js','vendor/solin-empty-transfer-v20261028-27.mdb'
];
for(const rel of required) {
 const orig=path.join(root,rel),dest=path.join(out,rel);
 assert(fs.existsSync(dest),'Functional PWA asset missing in APK: '+rel);
 assert.deepEqual(fs.readFileSync(dest),fs.readFileSync(orig),'Functional asset mismatch: '+rel);
}
const manifest=JSON.parse(read(root,'data-manifest.json'));
for(const rel of manifest.quarterChunks||[]){
 const orig=path.join(root,rel),dest=path.join(out,rel);
 assert(fs.existsSync(dest),'Forest quarter chunk missing from Android build: '+rel);
 assert.deepEqual(fs.readFileSync(orig),fs.readFileSync(dest),'Forest data differs in APK: '+rel);
}
console.log('APK_WEB_PARITY_OK: identical approved index, native-only service worker difference, '+verified+
 ' linked assets, original references and all sample forest quarters; same card and offline map modules');
