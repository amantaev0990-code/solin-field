// Capacitor uses the exact same assets as GitHub Pages, not the old Flutter clone.
// Security: Never bundle original MDB/ACCDB files, credentials or server code.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'www');
const extensions=new Set(['.html','.htm','.js','.mjs','.css','.json','.webmanifest','.png','.jpg','.jpeg','.webp','.svg','.ico','.gif','.gz','.wasm','.woff','.woff2','.ttf','.otf','.txt']);
const excluded=new Set(['node_modules','.git','.github','www','android','ios','flutter_app','mdb-service','scripts','windows','native','docs','.vscode']);
const forbidden=/\.(?:mdb|accdb|ldb|laccdb|ps1|zip|apk|aab|key|keystore|env)$/i;
if(fs.existsSync(out)) fs.rmSync(out,{recursive:true,force:true});
let count=0;
function copy(from,to,level=0){
 if(level>12)throw Error('Unexpected recursive asset tree');
 for(const ent of fs.readdirSync(from,{withFileTypes:true})){
  if(ent.name.startsWith('.')||excluded.has(ent.name))continue;
  const p=path.join(from,ent.name),dest=path.join(to,ent.name);
  if(ent.isSymbolicLink())continue;
  if(ent.isDirectory()){copy(p,dest,level+1);continue;}
  // Only the CI-verified BLANK 18-table template may enter an APK. All
  // original forest MDBs remain excluded, including matching filenames.
  const relative=path.relative(root,p).split(path.sep).join('/');
  const safeBlank=relative==='vendor/solin-empty-transfer-v20261028-27.mdb';
  if(!ent.isFile()||(!safeBlank&&(forbidden.test(ent.name)||!extensions.has(path.extname(ent.name).toLowerCase()))))continue;
  // Android's asset merger collapses compressed .gz names into the same
  // logical resource as the uncompressed file. A paired copy causes
  // "Duplicate resources" in Gradle (especially the bundled .NET WASM
  // _framework files). Native Capacitor uses the original uncompressed
  // resource; keep standalone .gz only when no original exists.
  if(ent.name.endsWith('.gz')&&fs.existsSync(p.slice(0,-3)))continue;
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(p,dest);count++;
 }
}
copy(root,out);
// AAPT strips .gz AND decompresses asset bytes inside Android APK.
// The old APK could not fetch refs-audit.json.gz, so all dependent
// source-backed selectors stayed grey with no values. Keep the same
// byte-identical compressed reference data under a safe .bin extension.
const packedReferences=[
 'refs-audit.json.gz','solin-control-norms.json.gz',
 'solin-control-source-recovery.json.gz'
];
for(const file of packedReferences){
 const original=path.join(root,file);
 const destination=path.join(out,file.slice(0,-8)+'.packed.bin');
 if(!fs.existsSync(original))throw Error('Missing source reference bundle: '+file);
 fs.copyFileSync(original,destination);
}
const htmlPath=path.join(out,'index.html');
let html=fs.readFileSync(htmlPath,'utf8');
if(!html.includes('<head>'))throw Error('Capacitor needs an HTML head');
if(!html.includes('solin-apk-mdb.js')) html=html.replace('</body>','<script src="solin-apk-mdb.js"></script></body>');
fs.writeFileSync(htmlPath,html);
const apkApp=path.join(out,'app.js');
let appSrc=fs.readFileSync(apkApp,'utf8');
appSrc=appSrc.replace("if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});",
  "if(!window.Capacitor?.isNativePlatform?.() && 'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});");
fs.writeFileSync(apkApp,appSrc);
if(!fs.existsSync(path.join(out,'data-meta.json'))||!fs.existsSync(path.join(out,'quarters/q1.json'))||!fs.existsSync(path.join(out,'vendor/mdb-reader.bundle.js'))||!fs.existsSync(path.join(out,'vendor/solin-empty-transfer-v20261028-27.mdb')))throw Error('Missing essential offline databases/maps');
console.log('SOLI-N Field APK assets: '+count+' files, copied to www; original MDB files excluded.');
