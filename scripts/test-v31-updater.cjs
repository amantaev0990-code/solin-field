// V31: safety and install-session contract. Run in CI before APK compilation.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('native/android/SolinUpdatePlugin.java','utf8');
const setup = fs.readFileSync('scripts/install-android-mdb.mjs','utf8');
const installed = process.argv.includes('--android');
for(const required of [
  'PackageInstaller.SessionParams.MODE_FULL_INSTALL',
  'installer.createSession(params)',
  'session.openWrite("base.apk", 0, apk.length())',
  'session.fsync(output)',
  'session.commit(pendingIntent.getIntentSender())',
  'PackageInstaller.STATUS_PENDING_USER_ACTION',
  'PackageInstaller.STATUS_SUCCESS',
  'PackageInstaller.EXTRA_STATUS_MESSAGE',
  'PendingIntent.FLAG_MUTABLE',
  'params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED)',
  'sameCertificate(oldPkg, newPkg)',
  'getPackageArchiveInfo',
  'MessageDigest',
]) assert.ok(source.includes(required), 'Native installer missing: '+required);
assert.ok(!source.includes('Intent.ACTION_VIEW'), 'Do not install directly from app cache URI');
assert.ok(!source.includes('ACTION_MANAGE_UNKNOWN_APP_SOURCES') || source.includes('canRequestPackageInstalls()'));
assert.ok(setup.includes('SolinUpdatePlugin$InstallResultReceiver'));
assert.ok(setup.includes('android:exported="false"'));
assert.ok(!source.includes('UPDATE_PACKAGES_WITHOUT_USER_ACTION'), 'No silent-install permission allowed');
if(installed) {
  const manifest=fs.readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
  assert.match(manifest, /SolinUpdatePlugin\$InstallResultReceiver/);
  assert.match(manifest, /REQUEST_INSTALL_PACKAGES/);
  assert.match(manifest, /exported="false" android:enabled="true"/);
  const plugin=fs.readFileSync('android/app/src/main/java/kz/solin/field/SolinUpdatePlugin.java','utf8');
  assert.equal(plugin,source,'Native Java plugin differs from reviewed source');
}
console.log('V31 PackageInstaller safety contract OK; device interaction confirmation still required.');