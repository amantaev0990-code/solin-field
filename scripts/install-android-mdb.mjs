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
 build=build.replace(/applicationId\s+"kz\.solin\.field(?:\.tablet(?:\.v\d+)?)?"/, 'applicationId "kz.solin.field.tablet.v11"');
 build=build.replace(/versionCode\s+\d+/, 'versionCode 11').replace(/versionName\s+"[^"]+"/,'versionName "0.3.0-tablet.11"');
 fs.writeFileSync(gradle,build);
 const stringsFile=path.join(app,'src/main/res/values/strings.xml');
 const strings=fs.readFileSync(stringsFile,'utf8').replace(/(<string name="app_name">)[^<]+/, '$1SOLI-N Field V11');
 fs.writeFileSync(stringsFile,strings);
}
console.log('Native Android MDB plugin and on-emulator roundtrip checks registered.');
