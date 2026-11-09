/* V36 overlay: preserve V35 cards, maps and all dictionaries. The sole
 * browser update is a retry-aware updater with progress and SHA verification.
 */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const source=fs.readFileSync('solin-updates.js','utf8');
const file='www/solin-updates.js';
const old=fs.readFileSync(file,'utf8');
for(const token of ['latestRelease','installRelease','sha256','SolinUpdate']){
 if(!old.includes(token)||!source.includes(token))throw Error('Updater source differs on '+token);
}
if(!source.includes('temporaryHttp')||!source.includes('progressHandle')||
   !source.includes('versionCode: release.versionCode'))
 throw Error('V36 source does not provide retry/progress/version contract');
fs.writeFileSync(file,source);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
if(hash(fs.readFileSync(file))!==hash(source))throw Error('V36 updater copy mismatch');
let html=fs.readFileSync('www/index.html','utf8');
const found=html.match(/solin-updates\.js\?v=[^"']+/g)||[];
if(found.length!==1)throw Error('Expected one V35 updater script reference, found '+found.length);
html=html.replace(found[0],'solin-updates.js?v=36-github-retry');
fs.writeFileSync('www/index.html',html);
console.log('V36: retry-aware updater installed over V35; all existing field records, cards, maps and source lookups remain unchanged.');
