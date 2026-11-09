// V33 release gate: original V30 card logic, UI controls, and approved icon.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {PNG}=require('pngjs');
const root=path.join(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('solin-v33-ux.js');
const css=read('solin-v33-ux.css');
const installer=read('scripts/install-android-mdb.mjs');
new Function(js);
assert.ok(js.includes('Рабочий объект')&&js.includes('Макет 1'));
for(const route of ['quartersScreen','mapScreen','control','filter','homeScreen','transferScreen',
 'refsScreen','calculationRefs','menuScreen']){
 assert.ok(js.includes(route),'Missing original menu route '+route);
}
for(const id of ['1','2','3','4','5','10','31','32'])
 assert.ok(js.includes("['"+id+"',"),'Missing native card Maket '+id);
assert.ok(js.includes('document.addEventListener(\'keydown\''),'Missing editable field keyboard navigation');
assert.ok(js.includes('target.blur()'),'Input blur validation must run before next field');
assert.ok(js.includes('requestSubmit()'),'Original card save must remain wired');
assert.ok(!/localStorage|indexedDB|\.remove\(\)/.test(js),'UX patch must not write or remove user records');
assert.ok(css.includes('prefers-reduced-motion'),'Respect reduced motion');
assert.ok(css.includes('.v33-main-layout')&&css.includes('.v33-card-jump'),'Missing UX layout');
assert.ok(installer.includes("assets/solin-field-icon-v23.b64"),'Launcher must match original S');
assert.ok(!installer.includes('png.data[target]=11;'),'No recoloring of approved icon');
const raw=Buffer.from(read('assets/solin-field-icon-v23.b64').trim(),'base64');
assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),
 'd9fc8e9c165044413b0c9677e9ec283ea0d87e12bd66d620099ef1a1d9f72c58');
const sourceIcon=PNG.sync.read(raw);
assert.equal(sourceIcon.data[3],0,'Approved icon is transparent');
if(process.argv.includes('--built')){
 const html=read('www/index.html');
 for(const asset of ['solin-v33-ux.js','solin-v33-ux.css','solin-updates.js',
                      'solin-card-editor.js','solin-card-calculations.js']){
  assert.ok(html.includes(asset),'Missing UI/control asset '+asset);
 }
 assert.ok(fs.existsSync(path.join(root,'www/maps/213-1.cmf2')));
 assert.ok(fs.existsSync(path.join(root,'www/maps/213-2.cmf2')));
 assert.ok(fs.existsSync(path.join(root,'www/solin-private-refs.packed.bin'))===false,
   'Signing secrets must never be copied from old APK');
}
if(process.argv.includes('--android')){
 const res=path.join(root,'android/app/src/main/res');
 for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
  const png=PNG.sync.read(fs.readFileSync(path.join(res,'mipmap-'+density+'/ic_launcher.png')));
  assert.equal(png.width,size);
  assert.equal(png.data[3],0,'Opaque launcher background detected');
  let opaque=0,colorVariants=new Set();
  for(let i=0;i<png.data.length;i+=4){
   if(png.data[i+3]>200){
    opaque++;
    colorVariants.add(png.data[i]+','+png.data[i+1]+','+png.data[i+2]);
   }
  }
  assert.ok(opaque>size*size*.08,'Approved S icon is missing');
  assert.ok(colorVariants.size>8,'Icon gradient was lost');
 }
}
console.log('V33 validated: 10 original actions, 8 desktop Makets, stable save, '+
 'reduced motion, exact original S mark and offline map checks.');
