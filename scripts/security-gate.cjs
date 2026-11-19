#!/usr/bin/env node
'use strict';
// Fast, dependency-free guard for accidentally committed credentials and
// private production artifacts. Does not claim to audit Git history.
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');

const tracked = cp.execFileSync('git', ['ls-files', '-z'], {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
}).split('\0').filter(Boolean);

const legacyMdb = new Set([
  'mdb-wasm-poc/blank-transfer.mdb',
  'vendor/solin-empty-transfer-v20261028-23.mdb',
  'vendor/solin-empty-transfer-v20261028-27.mdb'
]);
const blockedFiles = [
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:signing-private|credentials|service-account)(?:\.[^/]*)?\.json$/i,
  /(?:private.*backup|backup.*private).*\.(?:zip|7z|rar)$/i,
  /\.(?:p12|pfx|pem|key|keystore|jks|kdbx|ovpn|sqlite|sqlite3|mbtiles|accdb)$/i,
  /\.(?:mdb|apk|aab)$/i
];
const secretPatterns = [
  ['private key PEM block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['GitHub access token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Slack access token', /\bxox[baprs]-[0-9A-Za-z-]{18,}\b/]
];
const errors=[], warnings=[];
const isThirdParty = f => /^(?:vendor|flutter|mdb-wasm-poc\/_framework)\//.test(f);
const isSourceLike = f => /\.(?:js|mjs|cjs|ts|java|py|ps1|sh|yml|yaml|json|md|html|css|xml|properties)$/i.test(f);
let checked = 0;

for (const file of tracked) {
  const name = file.replaceAll('\\', '/');
  const exists = fs.existsSync(file);
  if (!exists) continue;
  if (legacyMdb.has(name)) {
    warnings.push('Already-published MDB template needs a separate provenance review: ' + name);
  } else if (blockedFiles.some(re => re.test(name))) {
    errors.push('Restricted file type tracked in Git: ' + name);
  }
  if (!isSourceLike(name) || isThirdParty(name)) continue;
  const st = fs.statSync(file);
  if (!st.isFile() || st.size > 1024 * 1024) continue;
  const text = fs.readFileSync(file, 'utf8');
  checked++;
  for (const [label,pattern] of secretPatterns) {
    if (pattern.test(text)) errors.push('Possible ' + label + ' in ' + name);
  }
}
if (tracked.some(f => /^quarters\/q\d+\.json$/.test(f))) {
  warnings.push('Public quarter datasets exist: rights and field-data clearance require manual review.');
}
console.log('SOLI-N source-security gate: ' + tracked.length + ' tracked files, ' + checked + ' text files scanned');
for (const warning of warnings) console.warn('WARNING: ' + warning);
if (errors.length) {
  for (const error of errors) console.error('ERROR: ' + error);
  console.error('STOP: do not publish sensitive material. Rotate any actual leaked secret.');
  process.exitCode = 1;
} else {
  console.log('PASS: no blocked new artifact paths or recognizable secrets in inspected files.');
  console.log('LIMITS: existing Git history, minified binaries, license rights, and APK reverse engineering are NOT verified.');
}
