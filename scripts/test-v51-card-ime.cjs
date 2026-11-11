'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const quick = fs.readFileSync('solin-quick-card.js','utf8');
const css = fs.readFileSync('solin-quick-card.css','utf8');
const forest = fs.readFileSync('solin-v35-features.js','utf8');
const required = [
  [/window\.visualViewport/,quick,'Use visual viewport for keyboard geometry'],
  [/vv\?\.addEventListener\('resize'/,quick,'Respond to keyboard resize'],
  [/modal\.classList\.toggle\('ce-ime-visible', editing\)/,quick,'Keyboard class from focused input'],
  [/function go\(n, focusFirst = false\)/,quick,'Tab switching must not focus fields'],
  [/if \(focusFirst\) focus\(fields\(\)\[0\]\)/,quick,'Enter can still advance to next field'],
  [/if \(following\) go\(following, true\)/,quick,'Keep Enter navigation between Makets'],
  [/#modal\.ce-modal #ce-form\.quick-card-form \.v33-card-jump/,css,'Hide old duplicate Maket strip'],
  [/#modal\.ce-modal\.ce-ime-visible \.modalCard/,css,'Resize dialog above keyboard'],
  [/#modal\.ce-modal\.ce-ime-visible #ce-form #ce-stock-audit/,css,'Collapse verbose calculator while typing'],
  [/window\.SolinForestGroups=\{/,forest,'Expose group chooser to compact card'],
  [/result\?\.groups\?\.length>1/,forest,'Only allow real source STL groups'],
  [/forestSelect\.value='';/,forest,'Discard incompatible type when group changes']
];
for(const [pattern,source,label] of required) assert.match(source,pattern,label);
assert.match(quick,/groupsButton\.hidden=!\(result\.groups\?\.length>1\)/);
console.log('V51 card/IME, no duplicate nav, and STL group-choice checks passed.');
