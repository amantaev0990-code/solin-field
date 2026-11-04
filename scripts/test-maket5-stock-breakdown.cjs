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
assert.equal(c.stockBreakdown(eighth).candidatePerHa,30,
 'Fresh deadwood is not living volume');
assert.equal(c.standStock(eighth).status,'complete',
 'Fresh deadwood must not make the independent live-stock sum ambiguous');
assert.equal(c.stockBreakdown(eighth).freshDeadwoodTotal,24,
 'Fresh standing deadwood is quantified per hectare and for the stand');
// Mixed stands are not monotypes. Each species from each live layer
// contributes its own recorded ZAP; IAR7 and IAR8 are different categories.
const mixed={...base,STUR1:1,STUR:2,M4SS:12,_children:{Макет10:[
 {IAR:1,POR:'В',KOEF:6,ZAP:30},
 {IAR:1,POR:'Б',KOEF:4,ZAP:20},
 {IAR:2,POR:'С',KOEF:7,ZAP:15},
 {IAR:3,POR:'Л',KOEF:3,ZAP:5},
 {IAR:4,POR:'ОС',KOEF:10,ZAP:8},
 {IAR:5,POR:'Т',KOEF:10,ZAP:7},
 {IAR:6,POR:'К',KOEF:10,ZAP:6},
 {IAR:7,POR:'С',ZAP:4},
 {IAR:8,POR:'Б',ZAP:12}
]}};
const mixedSnapshot=JSON.stringify(mixed);
const totals=c.standStock(mixed),parts=c.stockBreakdown(mixed);
assert.equal(totals.status,'complete');
assert.equal(totals.expectedPerHa,91);
assert.equal(totals.expectedTotal,182);
assert.equal(totals.liveSpeciesCount,7);
assert.equal(parts.byLayer.find(x=>x.iar===1)?.zap,50,
 'Two species within one tier must be summed exactly once');
assert.equal(parts.byLayer.find(x=>x.iar===2)?.zap,15);
assert.equal(parts.singleTreesPerHa,4);
assert.equal(parts.singleTreesTotal,8);
assert.equal(parts.freshDeadwoodPerHa,12);
assert.equal(parts.freshDeadwoodTotal,24);
assert.equal(parts.drywoodPerHa,12);
assert.equal(parts.drywoodTotal,24);
assert.equal(JSON.stringify(mixed),mixedSnapshot,'Never mutate the source data');
const mixedAudit=c.corrections(mixed,{SSHB:[],Szap:[]});
assert.deepEqual(Array.from(mixedAudit.issues,x=>x.field),['STUR1','STUR']);
assert.deepEqual(Array.from(mixedAudit.issues,x=>x.expected),[91,182]);
const unknown={...mixed,_children:{Макет10:[...mixed._children.Макет10,{IAR:3,POR:'И',ZAP:null}]}};
assert.equal(c.standStock(unknown).status,'waiting','Unknown timber volumes cannot be silently counted as zero');
const repeated={...mixed,_children:{Макет10:[...mixed._children.Макет10,{IAR:1,POR:'Б',ZAP:10}]}};
assert.equal(c.standStock(repeated).status,'ambiguous','Repeated species+layer might double-count timber');
const negative={...mixed,_children:{Макет10:[...mixed._children.Макет10,{IAR:3,POR:'И',ZAP:-7}]}};
assert.equal(c.standStock(negative).status,'ambiguous','Negative ZAP must never lower total');
const addressed={...mixed,_children:{Макет10:mixed._children.Макет10.map(r=>
 ({...r,POS:213,LESN:2,KV:1,KGLF:27,VD:'1'}))}};
const wrongForestMixed={...addressed,LESN:1};
assert.equal(c.standStock(wrongForestMixed).status,'waiting','Cross-forest rows must never contribute');
const mixedWithAlien={...addressed,_children:{Макет10:[...addressed._children.Макет10,
 {POS:999,LESN:2,KV:1,KGLF:27,VD:'1',IAR:2,POR:'С',ZAP:9999}]}};
assert.equal(c.standStock(mixedWithAlien).expectedPerHa,91,'Do not include another forest\'s row');
// Critical: do NOT claim mixed-layer normative K59 validation from a
// single leading-species table; only arithmetic of recorded ZAP is verified.
assert.equal(c.stockPerHectare(mixed,null,null).status,'unavailable');

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
console.log('MAKET5_LAYER_AUDIT_OK: seven species, mixed first and additional layers, separate fresh drywood/M4SS/single trees, totals, missing rows and duplicate protection');
