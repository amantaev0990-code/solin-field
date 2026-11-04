// Export public SDK utilities, never any CI signing key or user data.
import fs from 'node:fs';import path from 'node:path';
const sdk=process.env.ANDROID_SDK_ROOT||process.env.ANDROID_HOME;
if(!sdk)throw Error('Android SDK is unavailable');
const base=path.join(sdk,'build-tools'),versions=fs.readdirSync(base).filter(v=>/^\d+\.\d+\.\d+$/.test(v)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
const selected=versions.map(v=>path.join(base,v)).find(p=>['zipalign','aapt','lib/apksigner.jar'].every(f=>fs.existsSync(path.join(p,f))));
if(!selected)throw Error('Complete stable signing tools not found');
const out=path.resolve('android/cloud-lab-toolchain');fs.mkdirSync(out,{recursive:true});
for(const file of ['zipalign','aapt','lib/apksigner.jar','NOTICE.txt'])if(fs.existsSync(path.join(selected,file))){const dest=path.join(out,path.basename(file));fs.copyFileSync(path.join(selected,file),dest);if(!file.includes('/')&&file!=='NOTICE.txt')fs.chmodSync(dest,0o755);}
if(fs.existsSync(path.join(selected,'lib64')))fs.cpSync(path.join(selected,'lib64'),path.join(out,'lib64'),{recursive:true});
console.log('Public Android signing tools staged from build-tools '+path.basename(selected));
