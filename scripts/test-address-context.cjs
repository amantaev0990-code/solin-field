/* Source-grounded address code inheritance regression. No MDB or device mutation. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const catalogText=fs.readFileSync('solin-forest-catalog.js','utf8');
const context={window:{}};vm.runInNewContext(catalogText,context);
vm.runInNewContext(fs.readFileSync('solin-address-context.js','utf8'),context);
const A=context.window.SolinAddressContext,owner={POS:723,LESN:4,KTO:350000000};
assert.equal(A.originalKTO(723,4),350000000,'Original KUch: Шетское лесничество');
assert.equal(A.originalKTO(213,2),150000000,'Original KUch: Бугетсайское лесничество');
assert.equal(A.originalKTO(99999,1),null);
assert.equal(A.uniqueQuarterZone({Kpz:2},{Slxr:[{Kpz:2,Klxz:8},{Kpz:2,Klxz:8},{Kpz:3,Klxz:9}]}),'8');
assert.equal(A.uniqueQuarterZone({Kpz:2},{Slxr:[{Kpz:2,Klxz:8},{Kpz:2,Klxz:9}]}),null,'Slxr ambiguous: refuse to guess');
assert.equal(A.uniqueQuarterZone({Kpz:null},{Slxr:[{Kpz:2,Klxz:8}]}),null,'Missing natural zone cannot infer');
const q={quarterRows:[{POS:723,LESN:4,KV:1,KGLF:1,Klxr:8,Fzona:2,GodT:2026}]};
const missing={KV:1,KGLF:1,VD:1,PLV:1,KU:2,_children:{Макет10:[{POR:'В',IAR:1}]}};
const match=A.resolveQuarter(missing,q);
assert.equal(match?.Klxr,8);
const change=A.enrichStand(missing,q,owner);
assert.deepEqual(Object.keys(change.values).sort(),['Fzona','KlxrVD','LESN','POS']);
assert.equal(missing.POS,723);assert.equal(missing.LESN,4);
assert.equal(missing.KlxrVD,8);assert.equal(missing.Fzona,2);
assert.equal(A.enrichMakets(missing),5,'Makет10 receives complete address');
assert.equal(missing._children.Макет10[0].KGLF,1);
const existing={...missing,KlxrVD:6},old=JSON.stringify(existing);
assert.equal(A.resolveQuarter(existing,q),null,'Conflicting explicit zone is not silently overwritten');
assert.equal(Object.keys(A.enrichStand(existing,q,owner).values).length,0);
assert.equal(JSON.stringify(existing),old);
const zoneCascade={compartments:[
 {POS:723,LESN:4,KV:1,KGLF:1,KlxrVD:8},
 {POS:723,LESN:4,KV:1,KGLF:1,KlxrVD:7},
 {POS:723,LESN:4,KV:1,KGLF:2,KlxrVD:8}
]};
const sourceZone={POS:723,LESN:4,KV:1,KGLF:1,Klxr:8};
assert.equal(A.cascadeQuarterZone(zoneCascade,sourceZone,{...sourceZone,Klxr:'4'}),1,
 'Only stands with original quarter code should inherit explicit update');
assert.equal(zoneCascade.compartments[0].KlxrVD,'4');
assert.equal(zoneCascade.compartments[1].KlxrVD,7,'Manual override preserved');
assert.equal(zoneCascade.compartments[2].KlxrVD,8,'Different KGLF preserved');
const noZone={quarterRows:[{...q.quarterRows[0],Klxr:null}]};
const noZoneStand={...missing,KlxrVD:null};
assert.equal(A.enrichStand(noZoneStand,noZone,owner).values.KlxrVD,undefined,'Missing source: do not guess zone');
const ambiguous={quarterRows:[{...q.quarterRows[0],Fzona:null,Klxr:8},{...q.quarterRows[0],Fzona:null,Klxr:9}]};
const unassigned={POS:723,LESN:4,KV:1,KGLF:1,VD:1};
assert.equal(A.resolveQuarter(unassigned,ambiguous),null,'Multiple original quarter rows are ambiguous');
assert.equal(A.enrichStand(unassigned,ambiguous,owner).values.KlxrVD,undefined);
let total=0,mismatch=[];
for(let i=1;i<=10;i++){
 const quarters=JSON.parse(fs.readFileSync('quarters/q'+i+'.json','utf8'));
 for(const q of Object.values(quarters))for(const stand of q.compartments||[]){
  if(stand.KlxrVD==null)continue;
  const row=A.resolveQuarter(stand,q);
  if(row?.Klxr==null)continue;
  total++;
  if(String(row.Klxr)!==String(stand.KlxrVD))mismatch.push({KV:stand.KV,VD:stand.VD,quarter:row.Klxr,stand:stand.KlxrVD});
 }
}
assert.equal(total,471,'Match all 471 original quarter-to-stand zoning pairs');
assert.deepEqual(mismatch,[]);
vm.runInNewContext(fs.readFileSync('solin-card-calculations.js','utf8'),context);
const calc=context.window.SolinCardCalculations;
const card={POS:723,LESN:4,KV:1,KGLF:1,VD:1,KlxrVD:null,KU:2,PLV:1,M3Pr:'В',
 _children:{Макет10:[{POS:723,LESN:4,KV:1,KGLF:1,VD:1,IAR:1,KOEF:10,POR:'В',PH:6,POL:0.6,ZAP:150}]}};
const norm=calc.stockPerHectare(card,{Szap:[{Obl:350000000,p1:'В',LXZ:8,KUL:'.',v6:59}],SzapCK:[]},owner,match);
assert.equal(norm.status,'complete','K59 can use matched quarter Klxr without modifying the card');
assert.equal(norm.expected,35);
assert.equal(card.KlxrVD,null,'Pure calculation must not mutate existing data');
const missingNorm=calc.stockPerHectare(card,{Szap:[{Obl:350000000,p1:'В',LXZ:8,KUL:'.',v6:59}],SzapCK:[]},owner,null);
assert.equal(missingNorm.status,'waiting');
assert.match(missingNorm.reason,/укажите лесохозяйственную зону при редактировании квартала/i);
console.log('ADDRESS_CODES_OK: original forest KTO, 471/471 zone pairs, 723/4/1/1 quarter inheritance, ambiguous source safety, K59 quarter join');
