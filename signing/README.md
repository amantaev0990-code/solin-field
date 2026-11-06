# SOLI-N Field — permanent V23 signing identity

The **V23** certificate is the baseline for *all subsequent releases*. Do not generate a new signing key when building V24, V25, etc.

- Android application ID: `kz.solin.field.v23build` (must remain unchanged).
- Certificate SHA-256: `5A:1C:2E:2B:F2:EF:E5:AA:73:82:67:4B:65:15:33:A1:1D:2B:93:C8:02:A1:C0:9A:DC:72:65:6C:5A:29:ED:7E`.
- Alias: `solin-cloud-lab`.
- Valid through 27 October 2056.
- `signing/solin-v23-encrypted.p12.b64` is **password-protected AES-256 PKCS#12 encrypted data**. It is not a raw private key.
- The password is **not** in the repository. Never commit `signing-private.json`, the plaintext key, password, or a backup ZIP that includes the password.

## One-time secure GitHub Actions setup

In repository Settings → Secrets and variables → Actions → New repository secret:

`SOLIN_V23_KEYSTORE_PASSWORD` = the **password from the privately retained V23 signing backup** (`signing-private.json` in `V23_PRIVATE_SIGNING_BACKUP.zip`).

The GitHub integration available during preparation **cannot set Actions Secrets**. Until the owner adds this value, the manual signed build will intentionally fail rather than create another key or publish an incorrectly signed APK.

## Build

Actions → **SOLI-N Field V23 permanent signed APK** → Run workflow. Keep `source_ref` pointing to the reviewed V23-based source branch. The workflow:

1. Reuses the encrypted PKCS#12 key from this repository, unlocked only by the GitHub Actions Secret.
2. Pins Android `applicationId=kz.solin.field.v23build`.
3. Compiles an unsigned Android release, aligns it, signs with Android `apksigner` and verifies the fingerprint.
4. Publishes a signed release APK as an Actions artifact **only after verifying the identity**.

**Caution:** The original V23 APK contains additional private forest reference data that must be preserved when preparing a feature-complete update. Do not declare a newly compiled APK field-ready merely because its signing check passes. Validate MDB export/import and the original reference data separately. V22 uses a different certificate and package ID; it is no longer an update target.

## Disaster recovery

Keep a second copy of `V23_PRIVATE_SIGNING_BACKUP.zip` in a private location. Its password-bearing JSON must never be made public. Losing both the private backup and the GitHub Actions Secret would prevent future in-place updates, even though the encrypted P12 is present in GitHub.