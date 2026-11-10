// Run after npx cap add android. Deterministic, idempotent Android source setup.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const app=path.join(root,'android/app');
const activity=path.join(app,'src/main/java/kz/solin/field/MainActivity.java');
const plugin=path.join(app,'src/main/java/kz/solin/field/SolinMdbPlugin.java');
const gradle=path.join(app,'build.gradle');
if(!fs.existsSync(activity)||!fs.existsSync(gradle))throw Error('First run: npx cap add android (ensure appId is kz.solin.field).');
let main=fs.readFileSync(activity,'utf8');
if(!main.includes('registerPlugin(SolinMdbPlugin.class)')){
 const cls=main.indexOf('public class MainActivity extends BridgeActivity');
 if(cls<0)throw Error('Unknown MainActivity.java layout; register native MDB plugin manually');
 main=main.replace('public class MainActivity extends BridgeActivity {',
 'public class MainActivity extends BridgeActivity {\n  @Override public void onCreate(android.os.Bundle state) {\n    registerPlugin(SolinMdbPlugin.class);\n    super.onCreate(state);\n  }');
 fs.writeFileSync(activity,main);
}
fs.copyFileSync(path.join(root,'native/android/SolinMdbPlugin.java'),plugin);
// Real GNSS permission + native provider. WebView geolocation alone cannot
// request the Android runtime permission and may depend on network services.
fs.copyFileSync(path.join(root,'native/android/SolinLocationPlugin.java'),path.join(path.dirname(activity),'SolinLocationPlugin.java'));
main=fs.readFileSync(activity,'utf8');
if(!main.includes('registerPlugin(SolinLocationPlugin.class)')){
 main=main.replace('registerPlugin(SolinMdbPlugin.class);','registerPlugin(SolinMdbPlugin.class);\n    registerPlugin(SolinLocationPlugin.class);');
 fs.writeFileSync(activity,main);
}
const manifestFile=path.join(app,'src/main/AndroidManifest.xml');
let manifest=fs.readFileSync(manifestFile,'utf8');
for(const permission of ['ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION']){
 if(!manifest.includes('android.permission.'+permission))manifest=manifest.replace('</manifest>',
  '    <uses-permission android:name="android.permission.'+permission+'" />\n</manifest>');
}
if(!manifest.includes('android.hardware.location.gps'))manifest=manifest.replace('</manifest>',
 '    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\n</manifest>');
fs.writeFileSync(manifestFile,manifest);
// Install a native Android/JUnit test in the generated Capacitor project.
// Tests exercise the same private Jackcess writer invoked by the plugin,
// using the verified blank transfer template shipped in APK assets.
// Capacitor CLI generates a sample test with hard-coded
// "com.getcapacitor.app". It is unrelated to SOLI-N and fails under our
// real applicationId kz.solin.field; remove only this known template test.
const placeholderTest=path.join(app,'src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java');
if(fs.existsSync(placeholderTest)){
 const contents=fs.readFileSync(placeholderTest,'utf8');
 if(contents.includes('com.getcapacitor.app')&&contents.includes('ExampleInstrumentedTest'))
  fs.rmSync(placeholderTest);
}
const testSource=path.join(root,'native/android/SolinMdbInstrumentedTest.java');
const testDest=path.join(app,'src/androidTest/java/kz/solin/field/SolinMdbInstrumentedTest.java');
if(fs.existsSync(testSource)){
 fs.mkdirSync(path.dirname(testDest),{recursive:true});
 fs.copyFileSync(testSource,testDest);
}
// Run real WebView parity checks (forest, card, Maket10), not only MDB output.
const uiTestSource=path.join(root,'native/android/SolinFieldUiInstrumentedTest.java');
const uiTestDest=path.join(app,'src/androidTest/java/kz/solin/field/SolinFieldUiInstrumentedTest.java');
if(fs.existsSync(uiTestSource)){
 fs.mkdirSync(path.dirname(uiTestDest),{recursive:true});
 fs.copyFileSync(uiTestSource,uiTestDest);
}
fs.copyFileSync(path.join(root,'native/android/SolinGpsInstrumentedTest.java'),
 path.join(app,'src/androidTest/java/kz/solin/field/SolinGpsInstrumentedTest.java'));
let build=fs.readFileSync(gradle,'utf8');
const dep="implementation 'com.healthmarketscience.jackcess:jackcess:4.0.12'";
if(!build.includes(dep)){
 const pos=build.indexOf('dependencies {');
 if(pos<0)throw Error('Cannot find Android dependencies block');
 build=build.slice(0,pos+14)+'\n    '+dep+build.slice(pos+14);
 fs.writeFileSync(gradle,build);
}
const junitDep="androidTestImplementation 'androidx.test.ext:junit:1.2.1'";
const runnerDep="androidTestImplementation 'androidx.test:runner:1.6.2'";
for(const [marker,dep] of [['androidx.test.ext:junit',junitDep],['androidx.test:runner',runnerDep]]){
 if(build.includes(marker))continue;
 const start=build.indexOf('dependencies {');
 if(start<0)throw Error('Android dependencies block missing');
 build=build.slice(0,start+14)+'\n    '+dep+build.slice(start+14);
}
fs.writeFileSync(gradle,build);
if(process.env.SOLIN_TABLET_BUILD==='1'){
 // Historical APKs used ephemeral CI debug certificates. A separate app ID
 // allows field verification without uninstalling the old APK or its data.
 build=build.replace(/applicationId\s+"kz\.solin\.field(?:\.tablet(?:\.v\d+)?)?"/, 'applicationId "kz.solin.field.tablet.v14"');
 build=build.replace(/versionCode\s+\d+/, 'versionCode 14').replace(/versionName\s+"[^"]+"/,'versionName "0.3.0-tablet.14"');
 fs.writeFileSync(gradle,build);
 const stringsFile=path.join(app,'src/main/res/values/strings.xml');
 const strings=fs.readFileSync(stringsFile,'utf8').replace(/(<string name="app_name">)[^<]+/, '$1SOLI-N Field V14');
 fs.writeFileSync(stringsFile,strings);
}
if(process.env.SOLIN_CLOUD_LAB_BUILD==='1'){
 // Parallel package protects every installed V14 and its sandbox. Never
 // masquerade as an in-place upgrade without the original signing key.
 build=build.replace(/applicationId\s+"[^"]+"/,'applicationId "kz.solin.field.cloudlab"');
 build=build.replace(/versionCode\s+\d+/,'versionCode 23').replace(/versionName\s+"[^"]+"/,'versionName "0.3.0-cloudlab.20.0"');
 fs.writeFileSync(gradle,build);
 const stringsFile=path.join(app,'src/main/res/values/strings.xml');
 fs.writeFileSync(stringsFile,fs.readFileSync(stringsFile,'utf8').replace(/(<string name="app_name">)[^<]+/,'$1SOLI-N Field Lab'));
}
// V16 launcher: a single solid dark-green S, with transparent surroundings.
// Legacy launchers get antialiased PNGs; Adaptive Icons use the same outlined
// letter inside Android's safe zone with a transparent background layer.
const {PNG}=await import('pngjs');
// One verified approved S-with-leaf logo, for both Android launcher and PWA.
const iconBytes=Buffer.from(fs.readFileSync(path.join(root,'assets/solin-field-icon-v23.b64'),'utf8').trim(),'base64');
const {createHash}=await import('node:crypto');
if(createHash('sha256').update(iconBytes).digest('hex')!=='d9fc8e9c165044413b0c9677e9ec283ea0d87e12bd66d620099ef1a1d9f72c58')
 throw Error('Approved S launcher baseline mismatch');
if(iconBytes.length<1000||iconBytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
 throw Error('Launcher source is not a valid PNG');
const original=PNG.sync.read(iconBytes),w=original.width,h=original.height;
function drawIcon(size){
 const png=new PNG({width:size,height:size,filterType:4}),sx=w/size,sy=h/size;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const left=x*sx,right=(x+1)*sx,top=y*sy,bottom=(y+1)*sy;
  let alpha=0,red=0,green=0,blue=0;
  for(let iy=Math.floor(top);iy<Math.ceil(bottom);iy++)for(let ix=Math.floor(left);ix<Math.ceil(right);ix++){
   const weight=(Math.min(right,ix+1)-Math.max(left,ix))*(Math.min(bottom,iy+1)-Math.max(top,iy));
   if(weight<=0)continue;
   const source=(iy*w+ix)*4,opacity=original.data[source+3],factor=weight*opacity;
   alpha+=factor;red+=original.data[source]*factor;
   green+=original.data[source+1]*factor;blue+=original.data[source+2]*factor;
  }
  const target=(y*size+x)*4;
  png.data[target]=alpha?Math.round(red/alpha):0;
  png.data[target+1]=alpha?Math.round(green/alpha):0;
  png.data[target+2]=alpha?Math.round(blue/alpha):0;
  png.data[target+3]=Math.round(alpha/(sx*sy));
 }
 return PNG.sync.write(png);
}
const dest=path.join(app,'src/main/res');
for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
 const folder=path.join(dest,'mipmap-'+density);fs.mkdirSync(folder,{recursive:true});
 for(const name of ['ic_launcher.png','ic_launcher_round.png'])fs.writeFileSync(path.join(folder,name),drawIcon(size));
}
fs.mkdirSync(path.join(dest,'drawable'),{recursive:true});
fs.copyFileSync(path.join(root,'native/android/solin-field-launcher.xml'),path.join(dest,'drawable/solin_launcher.xml'));
fs.mkdirSync(path.join(dest,'raw'),{recursive:true});
fs.copyFileSync(path.join(root,'native/android/solin-launcher-LICENSE.txt'),path.join(dest,'raw/solin_launcher_license.txt'));
// Remove only the superseded generated bitmap to avoid duplicate resource IDs.
const previousBitmap=path.join(dest,'drawable-nodpi/solin_launcher.png');
if(fs.existsSync(previousBitmap))fs.rmSync(previousBitmap);
// Avoid Android adaptive-icon black backing: keep true-alpha legacy icons.
for(const name of ['ic_launcher.xml','ic_launcher_round.xml'])
 fs.rmSync(path.join(dest,'mipmap-anydpi-v26',name),{force:true});
let updatedManifest=fs.readFileSync(manifestFile,'utf8');
if(!/android:icon="[^"]+"/.test(updatedManifest))throw Error('AndroidManifest icon attribute not found');
updatedManifest=updatedManifest.replace(/android:icon="[^"]+"/,'android:icon="@mipmap/ic_launcher"');
updatedManifest=updatedManifest.replace(/android:roundIcon="[^"]+"/,'android:roundIcon="@mipmap/ic_launcher_round"');
fs.writeFileSync(manifestFile,updatedManifest);
// Optional GitHub release updater. It is excluded from Google Play builds,
// whose policies restrict REQUEST_INSTALL_PACKAGES.
if (process.env.SOLIN_GITHUB_UPDATES === '1') {
 const updateSrc=path.join(root,'native/android/SolinUpdatePlugin.java');
 if(!fs.existsSync(updateSrc))throw Error('Native update plugin source missing');
 fs.copyFileSync(updateSrc,path.join(path.dirname(activity),'SolinUpdatePlugin.java'));
 main=fs.readFileSync(activity,'utf8');
 if(!main.includes('registerPlugin(SolinUpdatePlugin.class)')){
   if(!main.includes('registerPlugin(SolinMdbPlugin.class);'))throw Error('Native MDB registration missing');
   main=main.replace('registerPlugin(SolinMdbPlugin.class);',
      'registerPlugin(SolinMdbPlugin.class);\\n    registerPlugin(SolinUpdatePlugin.class);'.replace('\\n','\n'));
   fs.writeFileSync(activity,main);
 }
 // Honor the established rule on physical Android Back and gesture Back:
 // when a dialog is visible, do not dismiss it or leave its activity.
 // Outside dialogs Android's normal navigation behavior remains unchanged.
 main=fs.readFileSync(activity,'utf8');
 if(!main.includes('SolinOnlyXBackDispatcher')){
   const marker='    super.onCreate(state);';
   if(!main.includes(marker))throw Error('Expected BridgeActivity onCreate marker missing');
   const hook=`
    // SolinOnlyXBackDispatcher: Android Back NEVER exits the application.
    // The WebView router navigates to the previous screen, but leaves dialogs
    // open for the explicitly visible X button and confirmation of drafts.
    getOnBackPressedDispatcher().addCallback(this,
        new androidx.activity.OnBackPressedCallback(true) {
          @Override public void handleOnBackPressed() {
            android.webkit.WebView w = getBridge() == null ? null : getBridge().getWebView();
            if (w == null) return;
            w.evaluateJavascript(
                "(function(){try{return window.SolinV37&&window.SolinV37.back"
                + "?window.SolinV37.back():'blocked-root';}"
                + "catch(e){return 'blocked-error';}})()", null);
          }
        });
`;
   main=main.replace(marker,marker+hook);
   fs.writeFileSync(activity,main);
 }
 manifest=fs.readFileSync(manifestFile,'utf8');
 if(!manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES')){
   manifest=manifest.replace('</manifest>',
     '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n</manifest>');
 }
 const provider='<provider android:name="androidx.core.content.FileProvider" '+
     'android:authorities="${applicationId}.updater" android:exported="false" '+
     'android:grantUriPermissions="true"><meta-data android:name="android.support.FILE_PROVIDER_PATHS" '+
     'android:resource="@xml/solin_update_paths" /></provider>';
 if(!manifest.includes('android:authorities="${applicationId}.updater"')){
   if(!manifest.includes('</application>'))throw Error('AndroidManifest application node missing');
   manifest=manifest.replace('</application>', '    '+provider+'\n    </application>');
 }
 // PackageInstaller reports user confirmation and final install status
 // to a named, private component. It cannot be invoked by other apps.
 const receiver='<receiver android:name="kz.solin.field.SolinUpdatePlugin$InstallResultReceiver" '+
     'android:exported="false" android:enabled="true" />';
 if(!manifest.includes('SolinUpdatePlugin$InstallResultReceiver')){
   manifest=manifest.replace('</application>', '    '+receiver+'\n    </application>');
 }
 fs.writeFileSync(manifestFile,manifest);
 const xmlDir=path.join(app,'src/main/res/xml');
 fs.mkdirSync(xmlDir,{recursive:true});
 fs.writeFileSync(path.join(xmlDir,'solin_update_paths.xml'),
   '<?xml version="1.0" encoding="utf-8"?><paths xmlns:android="http://schemas.android.com/apk/res/android"><cache-path name="updates" path="updates/" /></paths>\n');
 console.log('Opt-in GitHub APK updater registered; pinned V23 identity and installer protections active.');
}
console.log('Native Android MDB, GPS and plain dark-green S launcher installed.');
