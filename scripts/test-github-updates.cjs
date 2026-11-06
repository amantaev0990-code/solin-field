// Unit tests for the isolated updater. Never contacts GitHub or installs APKs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(require('node:path').join(__dirname,'../solin-updates.js'),'utf8');
const status = {textContent:''};
const button = {disabled:false, addEventListener(){}};
let installers = [];
let info={packageId:'kz.solin.field.v23build',versionCode:230002,versionName:'V23'};
const doc = {
  readyState: 'loading',
  addEventListener(){},
  querySelector(){return {appendChild(){}};},
  createElement(){return button;},
  getElementById(id){return id==='solin-update-status'?status:button;}
};
const win={
  Capacitor: {
    isNativePlatform(){return true;},
    Plugins: { SolinUpdate: {
      async getInfo(){return info;},
      async installRelease(args){installers.push(args);return {installerOpened:true};}
    }}
  },
  fetch: async()=>({status:404,ok:false})
};
vm.runInNewContext(code,{window:win,document:doc,URL});
const release={
  draft:false,prerelease:false,tag_name:'solin-field-v230003',
  assets:[{
    name:'SOLIN-Field-update.apk',
    size:24808000,
    digest:'sha256:'+'b'.repeat(64),
    browser_download_url:'https://github.com/amantaev0990-code/solin-field/releases/download/solin-field-v230003/SOLIN-Field-update.apk'
  }]
};
function response(data){return async()=>({status:200,ok:true,json:async()=>data});}
(async()=>{
  assert.equal(await win.SolinUpdates.latestRelease(async()=>({status:404,ok:false})),null);
  await win.SolinUpdates.checkAndUpdate(async()=>({status:404,ok:false}));
  assert.equal(installers.length,0,'No release must not install');
  assert.match(status.textContent,/нет/);
  const verified=await win.SolinUpdates.latestRelease(response(release));
  assert.equal(verified.versionCode,230003);
  assert.equal(verified.sha256,'b'.repeat(64));
  await win.SolinUpdates.checkAndUpdate(response(release));
  assert.equal(installers.length,1);
  assert.equal(installers[0].sha256,'b'.repeat(64));
  assert.equal(installers[0].url,release.assets[0].browser_download_url);
  info.versionCode=230003;
  await win.SolinUpdates.checkAndUpdate(response(release));
  assert.equal(installers.length,1,'Same version must never reinstall');
  for (const invalid of [
    {...release,assets:[{...release.assets[0],digest:null}]},
    {...release,assets:[{...release.assets[0],browser_download_url:'https://bad.example.com/hacked.apk'}]},
    {...release,tag_name:'v123'},
    {...release,assets:[{...release.assets[0],size:0}]}
  ]) {
    await assert.rejects(win.SolinUpdates.latestRelease(response(invalid)));
  }
  assert.equal(installers.length,1,'Invalid releases must never install');
  console.log('SOLI-N updater: 404, newer, current, digest, origin and size gates OK.');
})().catch(e=>{console.error(e);process.exitCode=1});
