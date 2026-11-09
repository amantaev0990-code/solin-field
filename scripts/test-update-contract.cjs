/* Offline updater regression: no network, no APK install and no forest writes. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const updater = fs.readFileSync(path.join(root, 'solin-updates.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const java = fs.readFileSync(path.join(root, 'native/android/SolinUpdatePlugin.java'), 'utf8');
const installer = fs.readFileSync(path.join(root, 'scripts/install-android-mdb.mjs'), 'utf8');
assert.match(index, /solin-updates\.js\?/);
assert.match(installer, /SOLIN_GITHUB_UPDATES/);
assert.match(installer, /solin_update_paths\.xml/);
assert.match(java, /MessageDigest\.isEqual/);
assert.match(java, /MAX_APK_BYTES/);
assert.match(java, /oldPkg\.packageName\.equals\(newPkg\.packageName\)/);
assert.match(java, /code\(newPkg\) <= code\(oldPkg\)/);
assert.match(java, /session\.commit\(pendingIntent\.getIntentSender\(\)\)/);
assert.doesNotMatch(java, /deleteDatabase|SQLiteDatabase|localStorage/);

const host = {
  appendChild(el) { this.button = el; elements.set(el.id, el); },
  button: null
};
const elements = new Map();
const document = {
  readyState: 'complete',
  querySelector(q) { return q === '#menuScreen .workspace' ? host : null; },
  getElementById(id) { return elements.get(id) || null; },
  createElement() { return {addEventListener(event, fn) { this.listener = fn; }}; },
};
const window = {fetch: async () => { throw Error('unexpected live network call'); }};
const ctx = {window, document, URL, console};
vm.createContext(ctx);
vm.runInContext(updater, ctx, {filename:'solin-updates.js'});
assert.equal(host.button.id,'solin-update-button');
assert.equal(typeof window.SolinUpdates.latestRelease,'function');

const makeRelease = (n, digest='a'.repeat(64)) => ({
  tag_name: 'solin-field-v' + n, draft: false, prerelease: false,
  assets: [{
    name:'SOLIN-Field-update.apk',
    browser_download_url:'https://github.com/amantaev0990-code/solin-field/releases/download/solin-field-v'+n+'/SOLIN-Field-update.apk',
    digest:'sha256:' + digest, size: 24000000
  }]
});
const fetched = item => async () => ({
  status: item === null ? 404 : 200,
  ok: true,
  json: async () => item
});
(async()=>{
  assert.equal(await window.SolinUpdates.latestRelease(fetched(null)), null);
  const data = await window.SolinUpdates.latestRelease(fetched(makeRelease(230003)));
  assert.equal(data.versionCode,230003);
  assert.equal(data.sha256,'a'.repeat(64));
  await assert.rejects(() => window.SolinUpdates.latestRelease(fetched(makeRelease(230003, 'bogus'))), /SHA-256/);
  const forged=makeRelease(230003);
  forged.assets[0].browser_download_url='https://evil.example/SOLIN-Field-update.apk';
  await assert.rejects(() => window.SolinUpdates.latestRelease(fetched(forged)), /GitHub/);
  let calls = 0;
  window.Capacitor = {isNativePlatform:()=>true,Plugins:{SolinUpdate:{
    getInfo:async()=>({packageId:'kz.solin.field.v23build',versionCode:230002}),
    installRelease:async payload=>{calls++;assert.equal(payload.sha256,'a'.repeat(64));return {installerOpened:true}}
  }}};
  await window.SolinUpdates.checkAndUpdate(fetched(null));
  assert.equal(calls,0,'No release must never install');
  await window.SolinUpdates.checkAndUpdate(fetched(makeRelease(230002)));
  assert.equal(calls,0,'Same version must never install');
  await window.SolinUpdates.checkAndUpdate(fetched(makeRelease(230003)));
  assert.equal(calls,1,'New release should open Android installer only after validation');
  assert.equal(host.button.disabled,false);
  console.log('V23 updater: static checks, 404, wrong SHA, URL, old/new release PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
