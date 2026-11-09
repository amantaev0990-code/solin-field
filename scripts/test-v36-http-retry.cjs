/* V36: executable no-network regression for GitHub 504 retry behavior.
 * Proof of safety gates, no forest data mutation, no live APK installs.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'solin-updates.js'),'utf8');
const native=fs.readFileSync(path.join(root,'native/android/SolinUpdatePlugin.java'),'utf8');
for(const s of [
 'final int maxAttempts = 4','downloadApkOnce(location, target, task)',
 'status == 502 || status == 503 || status == 504',
 'progress(task, "retry", attempt, maxAttempts)',
 'sameCertificate(oldPkg, newPkg)',
 'MessageDigest.isEqual','code(newPkg) <= code(oldPkg)',
 'session.commit(pendingIntent.getIntentSender())',
 'safeRedirect(url)','task.timeLeft()'
])assert.ok(native.includes(s),'V36 native security/retry requirement missing: '+s);
assert.ok(!native.includes('deleteDatabase(')&&!native.includes('SQLiteDatabase'),
 'Native updater must not access forest data');
assert.ok(native.indexOf('private String downloadApkOnce(')>native.indexOf('private String downloadApk('));
const status={textContent:''},button={disabled:false,addEventListener(){}};
let nativeCalls=[],info={packageId:'kz.solin.field.v23build',versionCode:230015};
const document={
 readyState:'loading',addEventListener(){},
 querySelector(){return {appendChild(){}};},createElement(){return button;},
 getElementById(id){return id==='solin-update-status'?status:button;}
};
const window={
 Capacitor:{isNativePlatform(){return true;},Plugins:{SolinUpdate:{
   async getInfo(){return info;},
   async installRelease(args){nativeCalls.push(args);return {installerOpened:true};}
 }}},
 fetch:async()=>({status:404,ok:false})
};
vm.runInNewContext(source,{window,document,URL,setTimeout:callback=>{callback();return 1;},console});
const url='https://github.com/amantaev0990-code/solin-field/releases/download/solin-field-v230016/SOLIN-Field-update.apk';
const release={draft:false,prerelease:false,tag_name:'solin-field-v230016',assets:[
  {name:'SOLIN-Field-update.apk',size:28000000,digest:'sha256:'+'a'.repeat(64),browser_download_url:url}
]};
function scenario(statuses){let count=0;return {get calls(){return count;},fetch:async()=>{
 const status=statuses[Math.min(count++,statuses.length-1)];
 return {status,ok:status===200,json:async()=>release};
}};}
(async()=>{
 const transient=scenario([504,502,200]);
 const result=await window.SolinUpdates.latestRelease(transient.fetch);
 assert.equal(result.versionCode,230016);assert.equal(transient.calls,3);
 const forbidden=scenario([403,200]);
 await assert.rejects(window.SolinUpdates.latestRelease(forbidden.fetch),/HTTP 403/);
 assert.equal(forbidden.calls,1,'Permanent security failures never retry');
 const missing=scenario([404,200]);
 assert.equal(await window.SolinUpdates.latestRelease(missing.fetch),null);
 assert.equal(missing.calls,1,'Published-release 404 is not transient');
 const failure=scenario([504,503,502,200]);
 await assert.rejects(window.SolinUpdates.latestRelease(failure.fetch),/HTTP 502/);
 assert.equal(failure.calls,3,'Metadata retry count is strictly bounded');
 const run=scenario([504,200]);
 await window.SolinUpdates.checkAndUpdate(run.fetch);
 assert.equal(run.calls,2);
 assert.equal(nativeCalls.length,1);
 assert.equal(nativeCalls[0].url,url);
 assert.equal(nativeCalls[0].sha256,'a'.repeat(64));
 assert.equal(nativeCalls[0].versionCode,230016);
 assert.match(nativeCalls[0].requestId,/^solin-\d+$/);
 assert.equal(button.disabled,false);
 assert.match(status.textContent,/Подтверди обновление/);
 if(process.argv.includes('--built')){
   const bundled=fs.readFileSync(path.join(root,'www/solin-updates.js'));
   assert.equal(crypto.createHash('sha256').update(bundled).digest('hex'),
     crypto.createHash('sha256').update(source).digest('hex'));
   const index=fs.readFileSync(path.join(root,'www/index.html'),'utf8');
   assert.ok(index.includes('solin-updates.js?v=36-github-retry'));
   assert.ok(index.includes('solin-v35-features.js?v=35'),'V35 Maket3 choices must remain');
 }
 if(process.argv.includes('--android')){
  assert.equal(fs.readFileSync(path.join(root,'android/app/src/main/java/kz/solin/field/SolinUpdatePlugin.java'),'utf8'),native,
    'Actual Android plugin must equal reviewed retry-aware source');
 }
 console.log('V36 HTTP504 RETRY OK: bounded 504/502 recovery, no retry on 403/404, 4 native attempts and strict SHA/certificate checks');
})().catch(e=>{console.error(e);process.exitCode=1});
