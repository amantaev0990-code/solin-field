/* Run with: node scripts/test-safe-updater.cjs
 * No network, APK installation, field data, or private signing key required. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'solin-update-policy.js'),'utf8');
const context={window:{},URL};
vm.runInNewContext(code,context,{filename:'solin-update-policy.js'});
const p=context.window.SolinUpdatePolicy;
assert.equal(p.PACKAGE,'kz.solin.field.v23build');
assert.equal(p.CERT,'5A1C2E2BF2EFE5AA7382674B651533A11D2B93C802A1C09ADC72656C5A29ED7E');
function release(n=230002){
 return {tag_name:'solin-android-v'+n,draft:false,prerelease:false,
 assets:[{name:'SOLIN-Field-update.apk',state:'uploaded',size:24808611,
 digest:'sha256:'+'a'.repeat(64),
 browser_download_url:'https://github.com/amantaev0990-code/solin-field/releases/download/solin-android-v'+n+'/SOLIN-Field-update.apk'}]};
}
assert.equal(p.selectCandidate(release(),23).versionCode,230002);
assert.equal(p.selectCandidate(release(23),23),null,'never reinstall same version');
assert.equal(p.selectCandidate(release(22),23),null,'never downgrade');
let r=release();r.assets[0].digest=null;
assert.equal(p.selectCandidate(r,23),null,'missing GitHub SHA256 must fail');
r=release();r.assets[0].browser_download_url='https://example.com/other.apk';
assert.equal(p.selectCandidate(r,23),null,'untrusted host must fail');
r=release();r.assets.push({...r.assets[0]});
assert.equal(p.selectCandidate(r,23),null,'ambiguous release must fail');
r=release();r.prerelease=true;
assert.equal(p.selectCandidate(r,23),null,'pre-release not offered');
r=release();r.tag_name='arbitrary-tag';
assert.equal(p.selectCandidate(r,23),null,'release tag not trusted');
r=release();r.assets[0].size=0;
assert.equal(p.selectCandidate(r,23),null,'empty APK not accepted');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/solin-update-policy\.js/);
assert.match(html,/solin-updates\.js/);
assert.ok(html.indexOf('solin-updates.js')>html.indexOf('solin-mdb-wasm-entry.js'),'updater must load after existing app scripts');
const installer=fs.readFileSync(path.join(root,'scripts/install-android-mdb.mjs'),'utf8');
assert.match(installer,/registerPlugin\(SolinUpdatePlugin\.class\)/);
assert.match(installer,/FileProvider/);
assert.match(installer,/REQUEST_INSTALL_PACKAGES/);
assert.match(installer,/cache-path/);
const java=fs.readFileSync(path.join(root,'native/android/SolinUpdatePlugin.java'),'utf8');
assert.match(java,/getPackageArchiveInfo/);
assert.match(java,/EXPECTED_CERT\.equals\(certificate\(archive\)\)/);
assert.match(java,/hex\(hash\.digest\(\)\)\.equals\(expectedSha\)/);
assert.match(java,/intent\.addFlags\(Intent\.FLAG_GRANT_READ_URI_PERMISSION\)/);
assert.doesNotMatch(java,/deleteDatabase|clearApplicationUserData|ACTION_DELETE|ACTION_UNINSTALL_PACKAGE/);
console.log('SOLI-N safe updater: 18 contract and metadata validation assertions passed.');