/* Макет 5 stock regression on original documented Maket10ЗАП criteria. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync('solin-card-calculations.js','utf8'),{window});
const c=window.SolinCardCalculations,base={POS:213,LESN:2,KV:1,KGLF:27,VD:'1',
 KU:1,PLV:2,M3Pr:'В',STUR1:30,STUR:60,M4SS:7,
 _children:{Макет10:[{IAR:1,POR:'В',ZAP:30,KOEF:10,PH:6,POL:.6}]}};
const immutable=JSON.stringify(base);
assert.equal(c.standStock(base).expectedTotal,60);
const seven={...base,_children:{Макет10:[...base._children.Макет10,{IAR:7,POR:'В',ZAP:9}]}};
assert.equal(c.standStock(seven).expectedTotal,60,
 'SIAR 7 single trees are separate and never alter the source Maket10ZAP sum');
assert.equal(c.stockBreakdown(seven).singleTreesPerHa,9);
assert.equal(c.stockBreakdown(seven).included.length,1);
assert.equal(c.stockBreakdown(base).drywoodPerHa,7);
const dry={...base,M4SS:12};
assert.equal(c.standStock(dry).expectedTotal,60,
 'M4SS per hectare is a separate source field; no double count into STUR');
assert.equal(c.stockBreakdown(dry).drywoodPerHa,12);
const eighth={...base,_children:{Макет10:[...base._children.Макет10,{IAR:8,POR:'В',ZAP:12}]}};
assert.equal(c.stockBreakdown(eighth).freshDeadwoodPerHa,12);
assert.equal(c.stockBreakdown(eighth).candidatePerHa,42);
assert.equal(c.standStock(eighth).status,'ambiguous',
 'Different original Maket10ZAP groups must be flagged, not silently written');
const excluded={...base,_children:{Макет10:[...base._children.Макет10,{IAR:7,POR:'С',ZAP:50}]}};
assert.equal(c.standStock(excluded).expectedTotal,60);
const missing={...base,_children:{Макет10:[...base._children.Макет10,{IAR:2,POR:'В',ZAP:null}]}};
assert.equal(c.standStock(missing).status,'waiting',
 'Missing ZAP in a contributing layer must not silently produce a false total');
const other={...base,_children:{Макет10:[...base._children.Макет10,
 {POS:213,LESN:4,KV:1,KGLF:27,VD:'1',IAR:1,POR:'В',ZAP:500}]}};
assert.equal(c.standStock(other).expectedTotal,60,'No cross-forest stock mixing');
assert.equal(JSON.stringify(base),immutable,'Stock analysis must be pure');
const editor=fs.readFileSync('solin-card-editor.js','utf8');
for(const key of ['refreshStockPanel()','ce-stock-audit','ce-stock-single',
 'ce-stock-drywood','M4SS','recalculateEditedField({dataset'])
 assert(editor.includes(key),'Editor integration missing: '+key);
console.log('MAKET5_LAYER_AUDIT_OK: drywood, IAR 7, IAR 8, missing/other stock, read-only source');
