/* V37 overlays only five UI/navigation fixes on byte-verified V36 assets.
 * The original field logic, maps and user data are NEVER replaced by source
 * from earlier releases.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(f,'utf8');
const write=(f,v)=>fs.writeFileSync(f,v);
const source=read('solin-card-editor.js');
let editor=read('www/solin-card-editor.js');
const oldA="fixed('Главная порода (см. Основные данные)',description('ВыделВ','M3Pr',r.M3Pr)||r.M3Pr,210)";
const newA="cell('M3Pr',r.M3Pr,'base','ВыделВ',{label:'Главная порода',weight:2.1,split:true})";
const oldB="fixed('Тип леса (см. Основные данные)',description('ВыделВ','M3TLU',r.M3TLU)||r.M3TLU,260)";
const newB="cell('M3TLU',r.M3TLU,'base','ВыделВ',{label:'Характеристика типа леса',weight:2.6,split:true})";
for(const [oldText,newText]of [[oldA,newA],[oldB,newB]]){
 if(!source.includes(newText))throw Error('V37 reviewed card editor source missing '+newText);
 if(editor.split(oldText).length!==2)throw Error('Actual V36 card source differs; refusing unsafe replacement');
 editor=editor.replace(oldText,newText);
}
const duplicateStart='<div class="ce-v23-species"><span>';
const duplicateEnd='<div id="ce-table-Макет10">';
const start=editor.indexOf(duplicateStart),end=editor.indexOf(duplicateEnd,start);
if(start<0||end<0||end-start>1500)throw Error('Unexpected original Maket10 duplicates');
const section=editor.slice(start,end);
if(!section.includes("cell('M3Pr'")||!section.includes("cell('M3TLU'"))
 throw Error('Maket10 canonical field signature differs');
editor=editor.slice(0,start)+editor.slice(end);
if(editor.includes('ce-v23-species')||!editor.includes(newA)||!editor.includes(newB))
 throw Error('Maket3 canonical control migration incomplete');
write('www/solin-card-editor.js',editor);
// V35's full-screen helper now locates the ONE canonical select in Maket 3.
let v35=read('www/solin-v35-features.js');
const from="'#ce-form #ce-section-10 [data-ce-scope=\"base\"][data-ce-field=\"'+field+'\"]'";
const to="'#ce-form [data-ce-scope=\"base\"][data-ce-field=\"'+field+'\"]'";
if(!v35.includes(from))throw Error('Existing V35 field selector changed');
if(!read('solin-v35-features.js').includes(to))throw Error('Reviewed V37 V35-helper change absent');
v35=v35.replace(from,to);
write('www/solin-v35-features.js',v35);
// Text labels only. Source keys, schema columns and export strings untouched.
let renamed=0;
const uiRoot='www';
const all=fs.readdirSync(uiRoot,{withFileTypes:true});
for(const entry of all){
 if(!entry.isFile()||!/[.]((js)|(css)|(html))$/i.test(entry.name))continue;
 const file=path.join(uiRoot,entry.name);
 const before=read(file);
 const after=before.replace(/головное меню/gi,'Главное меню');
 if(after!==before){write(file,after);renamed++;}
}
// Load the clean startup shell before any application JS or old UI can paint.
let html=read('www/index.html');
if(html.includes('v37-boot-style')||html.includes('solin-v37-fixes.js'))
 throw Error('V37 injected twice');
const headMarker='<meta charset="utf-8">';
const instantStyle='<style id="v37-boot-style">html:not(.v37-ready) .app{visibility:hidden!important}#v37-splash{position:fixed;z-index:2147483000;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#f2f5f1;color:#185335;font:600 16px system-ui,Arial,sans-serif}#v37-splash img{width:96px;height:96px;object-fit:contain}</style>';
if(!html.includes(headMarker))throw Error('No stable head marker');
html=html.replace(headMarker,headMarker+instantStyle);
const match=html.match(/<body([^>]*)>/i);
if(!match)throw Error('No body root');
const splash='<div id="v37-splash" role="status"><img src="solin-field-icon.png" alt=""><strong>SOLI-N Field</strong><span data-v37-status>Загрузка рабочего пространства…</span></div>';
html=html.replace(match[0],match[0]+splash);
for(const [name,tag,anchor]of [
 ['solin-v37-fixes.css','<link rel="stylesheet" href="solin-v37-fixes.css?v=37">','</head>'],
 ['solin-v37-fixes.js','<script src="solin-v37-fixes.js?v=37"></script>','</body>']
]){
 if(!html.includes(anchor))throw Error('Missing V37 HTML anchor '+anchor);
 html=html.replace(anchor,tag+anchor);
 fs.copyFileSync(name,path.join(uiRoot,name));
}
write('www/index.html',html);
console.log('V37: single M3Pr/M3TLU in Maket3, no stand duplicate, no old menu flash, internal Back, red New stand; labels changed in '+renamed+' files.');
