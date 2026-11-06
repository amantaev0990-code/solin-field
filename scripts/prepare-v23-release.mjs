// After `npx cap add android`, native plugin setup and `npx cap sync android`,
// make a release installable as an update of SOLI-N Field V23 (not V22).
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const file = path.join(root,'android','app','build.gradle');
const nameFile = path.join(root,'android','app','src','main','res','values','strings.xml');
if (!fs.existsSync(file) || !fs.existsSync(nameFile)) throw new Error('Generate Android project first');
let gradle=fs.readFileSync(file,'utf8');
const found=gradle.match(/\bapplicationId\s+["']([^"']+)["']/);
if (!found || !['kz.solin.field','kz.solin.field.v23build'].includes(found[1])) {
 throw new Error('Unexpected Android applicationId: '+(found?.[1] ?? 'missing'));
}
const raw=process.env.SOLIN_RELEASE_VERSION_CODE||'230002';
if (!/^\d{1,8}$/.test(raw)||Number(raw)<=23)throw new Error('Version code must be greater than the V23 baseline');
const versionCode=Number(raw);
const versionName=`0.3.0-field-${versionCode}`;
gradle=gradle.replace(/\bapplicationId\s+["'][^"']+["']/,'applicationId "kz.solin.field.v23build"');
if (!/\bversionCode\s+\d+/.test(gradle)||!/\bversionName\s+["'][^"']+["']/.test(gradle)) throw new Error('Android version fields missing');
gradle=gradle.replace(/\bversionCode\s+\d+/,'versionCode '+versionCode);
gradle=gradle.replace(/\bversionName\s+["'][^"']+["']/,'versionName "'+versionName+'"');
fs.writeFileSync(file,gradle);
let strings=fs.readFileSync(nameFile,'utf8');
if (!/<string name="app_name">/.test(strings)) throw new Error('Android app name missing');
strings=strings.replace(/(<string name="app_name">)[^<]+/,'$1SOLI-N Field V23');
fs.writeFileSync(nameFile,strings);
console.log('V23 update identity locked: kz.solin.field.v23build, versionCode '+versionCode);