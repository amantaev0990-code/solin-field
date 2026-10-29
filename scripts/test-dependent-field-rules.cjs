/* Read-only regression of SOLI-N Access dependent combos (Solim.mdb).
 * Values 'В' / 'ВРТЗ', 8, 15, and 2278-row STL source come from
 * audited original. This small independent fixture is deliberately not a
 * replacement for full cross-district testing. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('solin-dependent-rules.js','utf8');
const ctx={window:{}};vm.runInNewContext(code,ctx,{filename:'solin-dependent-rules.js'});
const rule=ctx.window.SolinDependentRules;
const ref={
 SDP:[{KPC:'В',NDP:'Вяз',ОбПор:'В',DKP2:202500},{KPC:'ТВ',NDP:'Таволга',ОбПор:'КУСТ',DKP2:825500},{KPC:'Б',NDP:'Берёза',ОбПор:'Б',DKP2:302600}],
 STL:[
  {GPor:'В',Lxz:8,OblStl:15,GrTL:0,KTL:'  В',NTL:'Вязовник'},
  {GPor:'В',Lxz:8,OblStl:15,GrTL:0,KTL:'ВРТЗ',NTL:'Вязовник'},
  {GPor:'КУСТ',Lxz:8,OblStl:15,GrTL:0,KTL:'КУСТ',NTL:'Кустарник'},
  {GPor:'В',Lxz:8,OblStl:19,GrTL:0,KTL:'ВЛД',NTL:'Другой регион'},
  {GPor:'В',Lxz:11,OblStl:15,GrTL:0,KTL:'ВЛЗ',NTL:'Другая зона'},
  {GPor:'В',Lxz:8,OblStl:15,GrTL:1,KTL:'ВРТ1',NTL:'Другая группа'}
 ],
 SLM:[{KM:0,PM2R:0,NMR:'Нет'},{KM:10,PM2R:1,NMR:'Первое'},{KM:20,PM2R:2,NMR:'Второе'},{KM:30,PM2R:0,NMR:'Общее'}],
 SOV:[{KOV:0,Priz:0,NOV:'Нет'},{KOV:135,Priz:1,NOV:'Запрещённый первый'},{KOV:205,Priz:1,NOV:'Специальный'},{KOV:206,Priz:0,NOV:'Общий'},{KOV:207,Priz:0,NOV:'Другой'}],
 SDP_Tip:[{KPC:'В',DKP2:202500,NDP:'Вяз'},{KPC:'Б',DKP2:302600,NDP:'Берёза'},{KPC:'ТВ',DKP2:825500,NDP:'Таволга'}],
 SSP:[{KSP:0,K84:0,NSP:'Нет'},{KSP:1,K84:0,NSP:'Обычная'},{KSP:2,K84:1,NSP:'Группа 84'}]
};
const org={KTO:150000000};
const type=rule.forestTypes({M3Pr:'В',KlxrVD:8},org,ref);
assert.equal(type.status,'ambiguous'); // Cannot assume NE2A when several groups exist.
assert.equal(type.items.length,0);
assert.equal(rule.currentIsAllowed('ВРТ1',type),false);
const onlyZero={...ref,STL:ref.STL.filter(x=>x.GrTL===0)};
const single=rule.forestTypes({M3Pr:'В',KlxrVD:8},org,onlyZero);
assert.equal(single.status,'partial');
assert.deepEqual(Array.from(single.items,x=>x.value),['  В','ВРТЗ']);
assert.ok(single.items.every(x=>x.area===15&&x.zone===8));
assert.equal(rule.currentIsAllowed('ВРТЗ',single),true);
assert.equal(rule.currentIsAllowed('ВЛД',single),false);
assert.equal(rule.currentIsAllowed('  В',single),true);
const grouped=rule.forestTypes({M3Pr:'В',KlxrVD:8,NE2A:0},org,ref);
assert.equal(grouped.status,'complete');
assert.deepEqual(Array.from(grouped.items,x=>x.value),['  В','ВРТЗ']);
assert.equal(rule.currentIsAllowed('ВРТ1',grouped),false);
assert.deepEqual(Array.from(rule.forestTypes({M3Pr:'ТВ',KlxrVD:8},org,ref).items,x=>x.value),['КУСТ']);
assert.equal(rule.forestTypes({M3Pr:'В',KlxrVD:8},{KTO:null},ref).status,'unavailable');
const values=(form,f,row,card=row)=>Array.from(rule.options(form,f,row,card,org,ref).items,x=>x.value);
assert.deepEqual(values('ВыделВ','M2PM1',{}),['0','10','20','30']);
assert.deepEqual(values('ВыделВ','M22',{M2PM1:10}),['0','20','30']);
assert.deepEqual(values('ВыделВ','M23',{M2PM1:10,M22:20}),['0','30']);
assert.deepEqual(values('ВыделВ','M23',{M2PM1:10,M22:0}),['0']);
assert.deepEqual(values('ВыделВ','PRP2',{PRP1:'В'}),['Б']);
assert.deepEqual(values('ВыделВ','PLP1',{}),['ТВ']);
assert.deepEqual(values('Макет23','K1',{}),['0','205','206','207']);
assert.deepEqual(values('Макет23','K2',{K1:205}),['0','206','207']);
assert.deepEqual(values('Макет23','K3',{K1:205,K2:206}),['0','207']);
assert.equal(rule.currentIsAllowed(205,rule.options('Макет23','K2',{K1:205},null,org,ref)),false);
assert.deepEqual(values('Макет12','SV',{KTP:84}),['0','2']);
assert.deepEqual(values('Макет12','SV',{KTP:3}),['0','1']);
assert.deepEqual(values('Макет12','SB',{KTP:84}),['0','1']);
const stand={_children:{Макет10:[{POR:'В'},{POR:'Б'}]}};
assert.deepEqual(values('Макет16','Por16',{},stand),['В','Б']);
assert.equal(rule.options('Макет16','Por16',{}, {_children:{Макет10:[]}},org,ref).status,'waiting');
assert.equal(rule.suggestedOrigin('Б',ref),null);
ref.SLM.push({KM:51,PM2R:null,NMR:'NULL must not match zero'});
assert.ok(!values('ВыделВ','M2PM1',{}).includes('51'));
ref.SDP_Tip.push({KPC:'XX',DKP2:null,NDP:'NULL species group'});
assert.ok(!values('ВыделВ','PRP1',{}).includes('XX'));

assert.match(fs.readFileSync('solin-card-editor.js','utf8'),/function linkedIssues\(\)/);
console.log('SOLIN_DEPENDENCIES_OK: region, zone, genus, group, raw text keys, event lists, understorey, makets 12/16/23 and NULL rules');
