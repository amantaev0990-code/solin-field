/* V37 surgical overlay on the tested V36 APK public resources.
 * Fail closed if a baseline handler changes: never overwrite cards or MDBs.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
const source=fs.readFileSync('app.js','utf8');
const start=' const source=selectedKGLF==null?rows[0]:rows.find(x=>String(x.KGLF)===String(selectedKGLF));';
const end=" const schema=D.transfSchema?.['Выдел']||[];";
function extract(s){
 const a=s.indexOf(start);
 const marker=" // Keep the same quarter/category as the opened stand";
 const from=a>=0?a:s.indexOf(marker);
 const to=s.indexOf(end,from);
 return {from,to,content:from>=0&&to>from?s.slice(from,to):null};
}
const old=extract(app),updated=extract(source);
if(old.from<0||old.to<old.from||!updated.content||!updated.content.includes('const next=Math.max(0,'))
 throw Error('V37 app.js create-stand baseline diverged; do not rewrite blindly');
app=app.slice(0,old.from)+updated.content+app.slice(old.to);
const original='Fzona:source.Fzona,KlxrVD:source.Klxr,VD:next,PLV:1,KU:null,M3B:0,';
const replacement='Fzona:source.Fzona,KlxrVD:source.Klxr??source.KlxrVD,VD:next,PLV:1,KU:null,M3B:0,';
if(!app.includes(original))throw Error('V37 create-stand address code differs');
app=app.replace(original,replacement);
if(!app.includes('const known=(quarter.compartments||[]).find(')||
   !app.includes('const existing=quarter.compartments||[];'))
 throw Error('V37 create stand uniqueness patch missing');
fs.writeFileSync(appPath,app);
for(const f of ['solin-v37-ui.js','solin-v37-ui.css'])
 fs.copyFileSync(f,path.join('www',f));
const htmlPath='www/index.html';
let html=fs.readFileSync(htmlPath,'utf8');
if(!html.includes('solin-v35-features.js?v=35')||
   !html.includes('solin-updates.js?v=36-github-retry'))
 throw Error('V37 must be layered over EXACT V36 + V35 assets');
if(html.includes('solin-v37-ui.js')||html.includes('solin-v37-ui.css'))
 throw Error('V37 bundles already injected');
html=html.replace(/головное меню/gi,'Главное меню');
const critical='<style id="solin-v37-startup">html:not(.v37-menu-ready):not(.v37-menu-fallback) .screen.active {visibility:hidden!important;pointer-events:none!important;}</style>';
if(!html.includes('</head>')||!html.includes('</body>'))
 throw Error('Missing HTML boundaries for startup style');
html=html.replace('</head>',critical+'<link rel="stylesheet" href="solin-v37-ui.css?v=37"></head>');
html=html.replace('</body>','<script src="solin-v37-ui.js?v=37"></script></body>');
fs.writeFileSync(htmlPath,html);
console.log('V37 overlay: no startup flash; original menu title corrected; back navigation and safe Next-VD button ready.');
