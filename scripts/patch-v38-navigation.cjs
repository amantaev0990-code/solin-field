'use strict';
const fs = require('node:fs');
const path = require('node:path');
const dir = process.argv[2] || 'www';
const files = new Map();
function replace(file, pattern, replacement) {
  const name = path.join(dir, file);
  const original = files.get(name) ?? fs.readFileSync(name, 'utf8');
  const text = original.replace(/\n/g, '\n');
  const match = text.match(pattern);
  if (!match || text.slice(match.index + match[0].length).match(pattern))
    throw Error('Unexpected V37 navigation asset: ' + file + ' / ' + pattern);
  const updated = text.replace(pattern, () => replacement);
  files.set(name, original.includes('\n') ? updated.replace(/\n/g, '\n') : updated);
}

replace('app.js', /function show\(id\)\{[^\n]+behavior:'smooth'\}\)\}/, `function show(id) {
  const next = document.getElementById(id);
  if (!next?.classList.contains('screen') || next.classList.contains('active')) return;
  $$('.screen.active').forEach(screen => screen.classList.remove('active', 'screen-enter'));
  next.classList.add('active', 'screen-enter');
  $$('.sectionTab').forEach(tab => tab.classList.toggle('active', tab.dataset.s === id));
  if (id !== 'mapScreen') next.scrollTo({top: 0, left: 0, behavior: 'instant'});
  window.scrollTo({top: 0, left: 0, behavior: 'instant'});
}`);
replace('static-ui.js', /    const active=document\.getElementById\(id\);\n    if\(active&&id!=='mapScreen'\) active\.scrollTop=0;\n/, '');
replace('ui-patch.js', /    const previous=[^\n]+\n    baseShow\(id\);\n    const next=[\s\S]*?    \}\n/, '    baseShow(id);\n');
replace('solin-v35-features.js', / function animateScreen\(\)\{[\s\S]*? function init\(\)\{\n   animateScreen\(\);/, ' function init(){');
replace('solin-v35-motion.css', /\.field-shell\.v35-premium \.screen\.active\.v35-screen-in > \.workspace \{[\s\S]*?(?=\.field-shell\.v35-premium #modal)/, `@media (prefers-reduced-motion: no-preference) {
 .field-shell .screen.active.screen-enter > .workspace {
  animation: field-screen-enter 210ms ease-out;
 }
 #mapScreen { --screen-enter-offset: 0px; }
 @keyframes field-screen-enter {
  from { opacity: .62; transform: translateY(var(--screen-enter-offset, 6px)); }
  to { opacity: 1; transform: translateY(0); }
 }
}
`);
replace('solin-v35-motion.css', / \.field-shell\.v35-premium \.screen\.active\.v35-screen-in > \.workspace,\n/, '');
replace('solin-v33-ux.css', /\.field-shell\.v33-app \.screen\.active\.field-section-enter[^\n]+\n@keyframes v33-screen-enter[^\n]+\n/, '');
replace('v25-clean.css', /@media \(prefers-reduced-motion: no-preference\) \{\n \.field-shell \.screen\.active\.field-section-enter[\s\S]*?\n\}\n/, '');
for (const file of ['app.js', 'ui-patch.js', 'static-ui.js', 'solin-v35-features.js', 'solin-v35-motion.css', 'solin-v33-ux.css', 'v25-clean.css']) {
  const pattern = new RegExp(file.replace('.', '\\.') + '\\?v=[^"]+');
  replace('index.html', pattern, file + '?v=38-screen');
}
for (const [file, text] of files) fs.writeFileSync(file, text);
