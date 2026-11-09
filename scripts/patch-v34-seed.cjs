/* Hotfix the exact V30 production asset after SHA-pinned APK overlay.
 * Do not overwrite V30 with older web source (loss of maps/card features).
 */
'use strict';
const fs=require('node:fs');
const file='www/solin-usability.js';
const before=fs.readFileSync(file,'utf8');
const from="if(id==='card')document.querySelector('.quickActions').style.display='none';else document.querySelector('.quickActions').style.display='';";
const to="const bar=document.querySelector('.quickActions');if(bar)bar.style.display=id==='card'?'none':'';";
if(!before.includes(from))throw Error('V30 null-style bug signature changed; refusing blind patch');
const after=before.replace(from,to);
if(after===before||after.includes(from)||!after.includes(to))throw Error('V34 null-style repair failed');
fs.writeFileSync(file,after);
const htmlfile='www/index.html';
let html=fs.readFileSync(htmlfile,'utf8');
for(const asset of ['solin-v33-ux.js','solin-v33-ux.css']){
 const old=asset+'?v=33';
 if(!html.includes(old))throw Error('Missing V33 asset to upgrade: '+asset);
 html=html.replace(old,asset+'?v=34');
}
fs.writeFileSync(htmlfile,html);
console.log('V34 patched only the unsupported legacy quickActions lookup; all V30 data/assets untouched.');
