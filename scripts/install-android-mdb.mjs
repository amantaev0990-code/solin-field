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
 build=build.replace(/versionCode\s+\d+/,'versionCode 15').replace(/versionName\s+"[^"]+"/,'versionName "0.3.0-cloudlab.15"');
 fs.writeFileSync(gradle,build);
 const stringsFile=path.join(app,'src/main/res/values/strings.xml');
 fs.writeFileSync(stringsFile,fs.readFileSync(stringsFile,'utf8').replace(/(<string name="app_name">)[^<]+/,'$1SOLI-N Field Lab'));
}
// Android V13: the user-approved S / pixel forest / GPS icon.
// Preserve the original artwork, replace only white OUTER corners,
// slightly enlarge the motif, and install both legacy + Adaptive Icon
// resources. A legacy drawable alone gets a white system icon plate.
const {PNG}=await import('pngjs');
const iconSource=path.join(root,'native/android/solin-field-launcher.b64');
const iconBytes=Buffer.from(fs.readFileSync(iconSource,'utf8').trim(),'base64');
if(iconBytes.length<1000||iconBytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
 throw Error('Launcher source is not a valid PNG');
const original=PNG.sync.read(iconBytes);
const pixels=original.data,w=original.width,h=original.height;
const outside=new Uint8Array(w*h),stack=[];
const white=i=>{
 const p=i*4,r=pixels[p],g=pixels[p+1],b=pixels[p+2];
 return r>209&&g>209&&b>209&&Math.max(r,g,b)-Math.min(r,g,b)<30;
};
for(let x=0;x<w;x++)for(const y of [0,h-1]){
 const i=y*w+x;if(white(i)&&!outside[i]){outside[i]=1;stack.push(i);}
}
for(let y=0;y<h;y++)for(const x of [0,w-1]){
 const i=y*w+x;if(white(i)&&!outside[i]){outside[i]=1;stack.push(i);}
}
while(stack.length){
 const i=stack.pop(),x=i%w,y=Math.floor(i/w);
 for(const neighbor of [x>0?i-1:-1,x+1<w?i+1:-1,y>0?i-w:-1,y+1<h?i+w:-1]){
  if(neighbor>=0&&!outside[neighbor]&&white(neighbor)){
   outside[neighbor]=1;stack.push(neighbor);
  }
 }
}
function drawIcon(size){
 const png=new PNG({width:size,height:size,filterType:4});
 // Preserve the top tree and bottom GPS-grid while enlarging ~8%.
 const crop=Math.max(2,Math.round(Math.min(w,h)*.035));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const sx=Math.max(0,Math.min(w-1,Math.floor(crop+(x+.5)*(w-2*crop)/size)));
  const sy=Math.max(0,Math.min(h-1,Math.floor(crop+(y+.5)*(h-2*crop)/size)));
  const idx=sy*w+sx,source=idx*4,target=(y*size+x)*4;
  if(outside[idx]){
   png.data[target]=2;png.data[target+1]=55;png.data[target+2]=28;png.data[target+3]=255;
  }else{
   for(let c=0;c<4;c++)png.data[target+c]=pixels[source+c];
  }
 }
 return PNG.sync.write(png);
}
const dest=path.join(app,'src/main/res');
for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
 const folder=path.join(dest,'mipmap-'+density);
 fs.mkdirSync(folder,{recursive:true});
 for(const name of ['ic_launcher.png','ic_launcher_round.png'])fs.writeFileSync(path.join(folder,name),drawIcon(size));
}
fs.mkdirSync(path.join(dest,'drawable-nodpi'),{recursive:true});
fs.writeFileSync(path.join(dest,'drawable-nodpi/solin_launcher.png'),drawIcon(432));
fs.mkdirSync(path.join(dest,'values'),{recursive:true});
fs.writeFileSync(path.join(dest,'values/solin_icon_colors.xml'),
 '<?xml version="1.0" encoding="utf-8"?><resources><color name="solin_icon_bg">#02371C</color></resources>');
fs.mkdirSync(path.join(dest,'mipmap-anydpi-v26'),{recursive:true});
const adaptive='<?xml version="1.0" encoding="utf-8"?>'+
 '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">'+
 '<background android:drawable="@color/solin_icon_bg"/>'+
 '<foreground android:drawable="@drawable/solin_launcher"/>'+
 '</adaptive-icon>';
for(const name of ['ic_launcher.xml','ic_launcher_round.xml'])
 fs.writeFileSync(path.join(dest,'mipmap-anydpi-v26',name),adaptive);
let updatedManifest=fs.readFileSync(manifestFile,'utf8');
if(!/android:icon="[^"]+"/.test(updatedManifest))throw Error('AndroidManifest icon attribute not found');
updatedManifest=updatedManifest.replace(/android:icon="[^"]+"/,'android:icon="@mipmap/ic_launcher"');
updatedManifest=updatedManifest.replace(/android:roundIcon="[^"]+"/,'android:roundIcon="@mipmap/ic_launcher_round"');
fs.writeFileSync(manifestFile,updatedManifest);
console.log('Native Android MDB, GPS and V13 full-bleed Adaptive Icon installed.');
