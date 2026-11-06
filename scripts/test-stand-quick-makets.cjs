/* V24 regression: stand quick access must preserve forest/maket data.
 * This test intentionally uses only built-in Node and never edits a database.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const workflow=fs.readFileSync(path.join(__dirname,'../solin-workflow.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const updater=fs.readFileSync(path.join(__dirname,'../solin-updates.js'),'utf8');
const installer=fs.readFileSync(path.join(__dirname,'../native/android/SolinUpdatePlugin.java'),'utf8');
new Function(workflow);
new Function(updater);
assert.match(workflow,/id="wfQuickForestType"/,'Stand modal must include linked forest type field');
assert.match(workflow,/id="wfQuickMakets"/,'Stand modal must include additional Maket navigator');
assert.match(workflow,/id="wfQuickDestination"/,'One selector must give access to all Makets from stand modal');
assert.match(workflow,/id="wfQuickNavigate"/,'Navigation must be explicit and save changes first');
assert.match(workflow,/CORE\.filter\(m=>m!=='Макет10'\)/,'Use the original known Maket roster, no invented forms');
assert.match(workflow,/const forestRules=rules\?\.options\?\.\('ВыделВ','M3TLU'/,'Validate forest type against dependent source list before commit');
assert.match(workflow,/if\(forestChanged&&chosenForest&&\(/,'Stop invalid forest type changes before save');
assert.match(workflow,/const before=JSON\.stringify\(r\);[\s\S]*?try\{saveAll\(r\);\}catch\(e\)\{Object\.assign\(r,JSON\.parse\(before\)\)/,'Data must roll back if persist fails');
assert.match(workflow,/if\(CORE\.includes\(destination\)\)openMaket\(destination\)/,'Navigate only after save');
assert.match(workflow,/else if\(destination==='control'\)checkData\(r,true\)/,'Control route must use existing code');
assert.match(workflow,/else if\(destination==='print'\)printCard\(\)/,'Print route must use existing code');
assert.match(installer,/MessageDigest\.isEqual\(oldFingerprint, expected\)/,'Installed APK must be signed with pinned V23 certificate');
assert.match(installer,/MessageDigest\.isEqual\(newFingerprint, expected\)/,'Downloaded APK must be signed with pinned V23 certificate');
assert.match(installer,/\bgetCacheDir\(\)/,'Download only to app cache');
assert.match(installer,/ACTION_VIEW/,'Use Android system installer');
assert.match(index,/solin-updates\.js/,'Main application must load updater');
console.log('Stand editing, linked forest types, Maket navigation, pinned updater identity: OK');
