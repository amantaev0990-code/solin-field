'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || 'www';
function edit(file, anchor, replacement) {
  const target = path.join(root, file);
  const source = fs.readFileSync(target, 'utf8');
  if (source.split(anchor).length !== 2) throw Error('Unexpected V38 asset: ' + file);
  fs.writeFileSync(target, source.replace(anchor, () => replacement));
}
edit('solin-card-editor.js',
 'if(options.focus)focusControlIssue(options.focus);',
 `if(options.focus)focusControlIssue(options.focus);
 if(options.quick)window.SolinQuickCard.mount(form,{showMain,showExtra,showMaketNavigator});`);
edit('solin-v37-ui.js',
 '[role="dialog"][aria-modal="true"]:not(.hidden):not(#modal)',
 '[role="dialog"][aria-modal="true"]:not([hidden]):not(.hidden):not(#modal)');
edit('index.html','solin-card-editor.js?v=20261109-v28','solin-card-editor.js?v=39-quick');
edit('index.html','solin-v37-ui.js?v=37','solin-v37-ui.js?v=39-card');

edit('index.html','</head>','<link rel="stylesheet" href="solin-quick-card.css?v=39"></head>');
edit('index.html','</body>','<script src="solin-quick-card.js?v=39"></script></body>');
for (const file of ['solin-quick-card.css','solin-quick-card.js'])
  fs.copyFileSync(file,path.join(root,file));
