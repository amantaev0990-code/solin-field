'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || 'www';
const editor = path.join(root,'solin-card-editor.js');
const source = fs.readFileSync(editor,'utf8');
const anchor = "  if(form==='Макет10'&&f==='POL'){";
if (source.split(anchor).length !== 2) throw Error('Unexpected V41 card editor');
fs.writeFileSync(editor,source.replace(anchor,`  if(form==='Макет10'&&m==='ZAP: Is Not Null'&&
     !leadingMaket10Row(session.draft._children.Макет10,
       session.draft._children.Макет10.indexOf(row),session.draft))return false;
` + anchor));
