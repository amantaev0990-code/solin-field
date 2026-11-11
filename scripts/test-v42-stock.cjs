'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const root = process.argv[2] || 'www';
const editor = fs.readFileSync(root + '/solin-card-editor.js','utf8');
const app = fs.readFileSync(root + '/app.js','utf8');
const standNumberSource = app.slice(app.indexOf('function standNumber('),app.indexOf('function nextStandNumber('));
const audit = fs.readFileSync(root + '/solin-audit-data.js','utf8');
assert.ok(audit.includes('"form":"Макет10","name":"ZAP","source":"ZAP","rule":"Is Not Null"'));
const extract = (start,end) => {
  const from = editor.indexOf('function ' + start + '(');
  const to = editor.indexOf('function ' + end + '(',from + 1);
  assert.ok(from >= 0 && to > from);
  return editor.slice(from,to);
};
const lead = {IAR:1,POR:'Б',KOEF:7,ZAP:90};
const companion = {IAR:1,POR:'ОС',KOEF:3,ZAP:null};
const context = {
  session:{
    draft:{KV:1,VD:2,KU:1,PLV:1,M3Pr:'Б',M3TLU:'1',_children:{Макет10:[lead,companion]}},
    original:{},quarter:{},originalQuarter:{},baselines:new Map(),isNew:true,changedMakets:new Set(['Макет10'])
  },
  window:{}, keys:['POS','LESN','KV','KGLF','VD'], D:{quarters:{1:{compartments:[]}}}, document:{querySelector:() => null},
  linkedIssues:() => null, same:(a,b) => a === b, title:(_form,field) => field,
  solinCore:{validateRow:(form,row) =>
    form === 'Макет10' && row.ZAP == null ? ['ZAP: Is Not Null'] : []}
};
const validate = () => vm.runInNewContext(
  standNumberSource + extract('leadingMaket10Row','maket10InputCell') + extract('validate','cleanup') + 'validate()', context);
assert.doesNotThrow(validate, 'A mixed layer can save with ZAP only on its leading row');
context.session.draft.VD = '1а';
assert.doesNotThrow(validate, 'A letter suffix is valid');
context.D.quarters[1].compartments.push({KV:1, VD:'1А'});
assert.throws(validate, error => /уже есть/.test(error.message));
context.D.quarters[1].compartments.length = 0;
assert.equal(companion.ZAP,null);
lead.ZAP = null;
assert.throws(validate, error => error.field === 'ZAP' && error.index === 0);
lead.ZAP = 90;
companion.IAR = 2;
assert.throws(validate, error => error.field === 'ZAP' && error.index === 1);
companion.IAR = 1;
context.session.draft.KU = 19;
assert.throws(validate, error => error.field === 'ZAP' && error.message.includes('KU 19'));
console.log('V42 stock PASS: mixed new stand, required leading stock in each layer, KU19 guard');
