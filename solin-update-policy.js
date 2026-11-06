/* SOLI-N Field safe updates. Pure metadata validation; no application data access. */
(function(root) {
  'use strict';
  const REPOSITORY = 'amantaev0990-code/solin-field';
  const PACKAGE = 'kz.solin.field.v23build';
  const CERT = '5A1C2E2BF2EFE5AA7382674B651533A11D2B93C802A1C09ADC72656C5A29ED7E';
  const RELEASE_API = 'https://api.github.com/repos/' + REPOSITORY + '/releases/latest';
  const APK_ASSET = 'SOLIN-Field-update.apk';
  const SHA256 = /^sha256:([a-f0-9]{64})$/i;
  const RELEASE_TAG = /^solin-android-v([1-9][0-9]{1,9})$/;

  function selectCandidate(release, installedVersion) {
    if (!Number.isSafeInteger(installedVersion) || installedVersion <= 0) return null;
    if (!release || release.draft || release.prerelease) return null;
    const tag = String(release.tag_name || '');
    const match = RELEASE_TAG.exec(tag);
    if (!match) return null;
    const versionCode = Number(match[1]);
    if (!Number.isSafeInteger(versionCode) || versionCode <= installedVersion) return null;
    const matches = (Array.isArray(release.assets) ? release.assets : [])
      .filter(a => a && a.name === APK_ASSET && a.state === 'uploaded');
    // Refuse ambiguous or incomplete releases.
    if (matches.length !== 1) return null;
    const asset = matches[0];
    const digest = SHA256.exec(String(asset.digest || ''));
    if (!digest || !Number.isSafeInteger(asset.size) || asset.size < 5e6 || asset.size > 200e6) return null;
    let url;
    try { url = new URL(String(asset.browser_download_url || '')); } catch (_) { return null; }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password ||
        url.search || url.hash) return null;
    const expected = '/' + REPOSITORY + '/releases/download/' + encodeURIComponent(tag) + '/' + APK_ASSET;
    if (url.pathname !== expected) return null;
    return Object.freeze({versionCode, tag, url: url.href, size: asset.size,
      sha256: digest[1].toLowerCase(), description: String(release.name || tag).slice(0, 80)});
  }
  root.SolinUpdatePolicy = Object.freeze({REPOSITORY, PACKAGE, CERT, RELEASE_API, APK_ASSET, selectCandidate});
})(typeof window !== 'undefined' ? window : globalThis);
