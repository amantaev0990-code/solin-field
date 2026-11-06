// Google Play policy gate for SOLI-N Field. Run AFTER native plugin setup and
// prepare-v23-release.mjs; requires a generated Capacitor Android project.
// No private signing keys or passwords are stored in this script.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const variablesPath = path.join(root, 'android', 'variables.gradle');
const appGradlePath = path.join(root, 'android', 'app', 'build.gradle');
if (!fs.existsSync(variablesPath) || !fs.existsSync(appGradlePath)) {
  throw new Error('Generate the Android project first (npx cap add android)');
}
const app = fs.readFileSync(appGradlePath, 'utf8');
const applicationId = /\bapplicationId\s+["']([^"']+)["']/.exec(app)?.[1];
if (applicationId !== 'kz.solin.field.v23build') {
  throw new Error('Play package mismatch; expected kz.solin.field.v23build, got ' + applicationId);
}
const versionCode = Number(/\bversionCode\s+(\d+)/.exec(app)?.[1]);
if (!Number.isSafeInteger(versionCode) || versionCode <= 23) {
  throw new Error('A strictly increasing release versionCode > 23 is required');
}
let variables = fs.readFileSync(variablesPath, 'utf8');
for (const name of ['compileSdkVersion', 'targetSdkVersion']) {
  // Capacitor normally stores version numbers in android/variables.gradle.
  const re = new RegExp('\\b(' + name + '\\s*=\\s*)(\\d+)');
  const found = re.exec(variables);
  if (!found) throw new Error('Missing ' + name + ' in generated Android variables.gradle');
  if (Number(found[2]) < 36) variables = variables.replace(re, (_, prefix) => prefix + '36');
}
fs.writeFileSync(variablesPath, variables);
for (const name of ['compileSdkVersion', 'targetSdkVersion']) {
  const value = Number(new RegExp('\\b' + name + '\\s*=\\s*(\\d+)').exec(variables)?.[1]);
  if (value < 36) throw new Error(name + ' must be Android API 36 or higher');
}
console.log('Google Play AAB gate: ' + applicationId + ', versionCode ' + versionCode + ', target API 36+.');