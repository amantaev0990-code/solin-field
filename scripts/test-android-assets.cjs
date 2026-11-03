/* Verify Capacitor's staged Android content is safe and mergeable.
 * Execute after: npm run build. Never touch original MDB databases. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../www');
assert(fs.existsSync(path.join(root,'index.html')),'Web entry point missing');
assert(fs.existsSync(path.join(root,'vendor/solin-empty-transfer-v20261028-27.mdb')),
 'Only verified blank MDB template belongs in the native bundle');
const files=[];
function walk(dir){
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,ent.name);
  if(ent.isDirectory())walk(p);
  else if(ent.isFile())files.push(p);
 }
}
walk(root);
const dup=files.filter(p=>p.endsWith('.gz')&&fs.existsSync(p.slice(0,-3)));
assert.equal(dup.length,0,'Gradle duplicate resources due to .gz/raw pairs: '+dup.slice(0,8).join(', '));
const mdb=files.filter(p=>/\.(mdb|accdb)$/i.test(p));
assert.deepEqual(mdb.map(p=>path.relative(root,p).replaceAll(path.sep,'/')),
 ['vendor/solin-empty-transfer-v20261028-27.mdb'],
 'Never include real forest databases in an APK');
// Field-test guarantee: the APK must contain the same latest, audited source
// files as the current web app, never the outdated prototype copied earlier.
// build-mobile.mjs may adapt app.js/index.html but the functional modules
// below must be copied byte-for-byte, including the current K58 workflow.
const sourceRoot=path.resolve(__dirname,'..');
for(const name of [
 'solin-workflow.js','solin-workflow.css','solin-card-calculations.js',
 'solin-card-editor.js','solin-species-entry.js','solin-species-entry.css',
 'solin-quarter-pickers.js','solin-workspace.js'
]){
 const source=path.join(sourceRoot,name),staged=path.join(root,name);
 assert(fs.existsSync(source)&&fs.existsSync(staged),'APK is missing latest source module: '+name);
 assert.equal(fs.readFileSync(staged,'utf8'),fs.readFileSync(source,'utf8'),
  'Stale staged APK module: '+name);
}
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(index.includes('solin-workflow.js')&&index.includes('solin-card-calculations.js')&&
 index.includes('solin-species-entry.js')&&index.includes('solin-card-editor.js'),
 'APK entry point must load the actual current calculation and entry modules');
const plugin=path.join(__dirname,'../native/android/SolinMdbPlugin.java');
assert(fs.existsSync(plugin),'Offline native MDB bridge missing');
console.log('ANDROID_ASSET_STAGING_OK',files.length,'assets, current K58/editor/field modules match source, no compressed/raw duplicate, only blank MDB template');
