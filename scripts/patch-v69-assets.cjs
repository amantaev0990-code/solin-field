'use strict';
const fs=require('node:fs');
const path=require('node:path');

const source=path.join(__dirname,'..');
const output=path.resolve(process.argv[2]||'www');
const assets=[
 'solin-calculation-refs.js',
 'solin-card-calculations.js',
 'solin-card-editor.css',
 'solin-card-editor.js',
 'solin-readable.css',
 'solin-readable.js'
];
const index=path.join(output,'index.html');
let html=fs.readFileSync(index,'utf8');
for(const name of assets){
 const ref=new RegExp('((?:src|href)="'+name.replaceAll('.','\\.')+')(?:\\?v=[^"]*)?(\")','g');
 if([...html.matchAll(ref)].length!==1)throw Error('Unexpected V68 asset reference: '+name);
 html=html.replace(ref,'$1?v=69$2');
 fs.copyFileSync(path.join(source,name),path.join(output,name));
}
fs.writeFileSync(index,html);
