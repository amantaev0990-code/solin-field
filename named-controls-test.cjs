'use strict';

// Original ВыделКвВыб/ВыделВыдВыб join: POS, LESN, KV, KGLF,
// Квартал.Klxr = Выдел.KlxrVD, and Fzona. Exercise the public runner.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = {
  D: { quarters: {} },
  window: { SOLIN_REFS: { tables: { SDP_Tip: [{ KPC: 'Е', ОбПор: 'Е', NDR: 1 }] } } }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'solin-named-controls.js'), 'utf8'), sandbox);
const { run, check04 } = sandbox.window.solinNamedControls;

const quarter = { POS: 213, LESN: 2, KV: 1, KGLF: 27, Klxr: 16, Fzona: 1, Kpz: 5 };
// This stand must trigger К39 whenever an exact quarter row supplies its context.
const stand = {
  POS: 213, LESN: 2, KV: 1, KGLF: 27, KlxrVD: 16, Fzona: 1,
  VD: '1', KU: 1, OZU: 0, M3Pr: 'Е', _children: {}
};
let checked = 0;
function contextCase(label, quarters, expected, record = stand, legacyMeta = false) {
  sandbox.D.quarters = { 1: legacyMeta ? { meta: quarters[0] } : { quarterRows: quarters } };
  const result = run([record]).find(x => x.control === 'К39');
  assert.ok(result, label + ': К39 result missing');
  assert.equal(result.status, expected, label);
  checked++;
}

contextCase('Exact match of all six fields', [quarter], 'Ошибка');
for (const [field, value] of [
  ['POS', 999], ['LESN', 9], ['KV', 2], ['KGLF', 24], ['Klxr', 17], ['Fzona', 2]
]) {
  contextCase('Reject sole quarter with wrong ' + field, [{ ...quarter, [field]: value }], 'Не проверено');
}
contextCase('Same category, different forest zones', [quarter, { ...quarter, Klxr: 17 }], 'Ошибка');
contextCase('Same category, different functional zones', [{ ...quarter, Fzona: 2 }, quarter], 'Ошибка');
contextCase('Other category does not make exact match ambiguous', [{ ...quarter, KGLF: 24 }, quarter], 'Ошибка');
contextCase('Two NULL functional zones do not join', [{ ...quarter, Fzona: null }], 'Не проверено', { ...stand, Fzona: null });
contextCase('Two NULL forest zones do not join', [{ ...quarter, Klxr: null }], 'Не проверено', { ...stand, KlxrVD: null });
contextCase('Exact row may appear after other rows of same category', [
  { ...quarter, Klxr: 20, Fzona: 2 }, quarter, { ...quarter, Klxr: 17, Fzona: 3 }
], 'Ошибка');
contextCase('Duplicate exact rows are ambiguous', [quarter, { ...quarter }], 'Не проверено');
contextCase('Missing quarter cannot supply context', [], 'Не проверено');
contextCase('Legacy meta must also match the full key', [quarter], 'Ошибка', stand, true);
contextCase('Legacy meta cannot supply a foreign category', [{ ...quarter, KGLF: 24 }], 'Не проверено', stand, true);

function marshCase(label, row, expected) {
  const record = { KU: 60, _children: row === undefined ? {} : { Макет19: [row] } };
  assert.equal(check04(record)[0].status, expected, label);
  checked++;
}
marshCase('К04: empty ZP with nonzero ZPR remains allowed by original SQL', { TB: 1, TR: 1, ZP: '', ZPR: 20 }, 'Пройден');
marshCase('К04: NULL ZP with nonzero ZPR is an error', { TB: 1, TR: 1, ZP: null, ZPR: 20 }, 'Ошибка');
marshCase('К04: NULL TR alone is not an original error condition', { TB: 1, TR: null, ZP: '', ZPR: null }, 'Пройден');
marshCase('К04: missing swamp record produces NULL TB', undefined, 'Ошибка');
marshCase('К04: specified ZP requires non-NULL ZPR', { TB: 1, TR: 1, ZP: 'С', ZPR: null }, 'Ошибка');

console.log('Named controls: ' + checked + ' regression cases passed.');
