/* V35: patch precisely the source-backed dependent rules in the signed V34
 * web baseline. Preserve every other corrected field and calculated module.
 */
'use strict';
const fs=require('node:fs');
function read(p){return fs.readFileSync(p,'utf8');}
function put(p,s){fs.writeFileSync(p,s);}
function replaceSection(text,start,end,replacement,label){
 const i=text.indexOf(start),j=text.indexOf(end,i+start.length);
 if(i<0||j<0||j<=i)throw Error('V35: baseline differs for '+label+'; refusing an unreviewed overwrite');
 return text.slice(0,i)+replacement+text.slice(j);
}
const depSrc=read('solin-dependent-rules.js'),depFile='www/solin-dependent-rules.js';
let dep=read(depFile);
const forestStart='function forestTypes(card,org,refs=ref()){';
const forestEnd='// Original ВыделВ.KU';
const srcA=depSrc.indexOf(forestStart),srcB=depSrc.indexOf(forestEnd,srcA);
if(srcA<0||srcB<0)throw Error('Source forestTypes not found');
dep=replaceSection(dep,forestStart,forestEnd,depSrc.slice(srcA,srcB),'STL forestTypes');
const speciesStart="if(form==='ВыделВ'&&field==='M3Pr'){";
const speciesEnd='if(!refs)return';
const srcC=depSrc.indexOf(speciesStart),srcD=depSrc.indexOf(speciesEnd,srcC);
if(srcC<0||srcD<0)throw Error('Source M3Pr RowSource not found');
dep=replaceSection(dep,speciesStart,speciesEnd,depSrc.slice(srcC,srcD),'SDP species');
if(!dep.includes('const ambiguous=!groupKnown&&groups.length>1')||!dep.includes('const fallback=!original'))
 throw Error('Source-backed dependent dropdown patch failed');
put(depFile,dep);
const assistSrc=read('solin-card-assist.js');
const assistFile='www/solin-card-assist.js';
let assist=read(assistFile);
const old='window.SolinCardAssist={openFieldPicker:editPicker,openRowEditor:editSelectedRow,openSequence:editSequence};';
const srcKey='window.SolinCardAssist={';
const ai=assistSrc.indexOf(srcKey),endTag='\n  };',aj=assistSrc.indexOf(endTag,ai);
if(ai<0||aj<0||!assist.includes(old))throw Error('V35 card helper API differs; refusing unreviewed overwrite');
assist=assist.replace(old,assistSrc.slice(ai,aj+endTag.length));
if(!assist.includes('openFieldByKey(field)'))throw Error('Missing searchable species helper');
put(assistFile,assist);
// Overlay always keeps V34 stable menu and installed user's forest data.
for(const asset of ['solin-v35-features.js','solin-v35-motion.css'])
 fs.copyFileSync(asset,'www/'+asset);
let html=read('www/index.html');
for(const [asset,markup,anchor]of [
 ['solin-v35-motion.css','<link rel="stylesheet" href="solin-v35-motion.css?v=35">','</head>'],
 ['solin-v35-features.js','<script src="solin-v35-features.js?v=35"></script>','</body>']
]){
 if(html.includes(asset))throw Error('Duplicate new feature '+asset);
 if(!html.includes(anchor))throw Error('Missing HTML position for '+asset);
 html=html.replace(anchor,markup+anchor);
}
put('www/index.html',html);
console.log('V35: original STL/SDP filtering, card-select bridge and premium transitions injected into current V34 resources.');
