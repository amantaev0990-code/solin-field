'use strict';
// Whole-card SOLI-N source RowSource integrity: edit, delete, full Save and
// legacy import. Fixtures only where physical extraction lacks VBA metadata.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('solin-dependent-rules.js','utf8'),ctx);
const rules=ctx.window.SolinDependentRules,org={KTO:150000000};
const refs={
 SKU:[{KU:2,NKU:'Лесные культуры',P10:5}],
 SIAR:[{Ia:5,KIAR:1,NIAR:'Ярус I'},{Ia:5,KIAR:8,NIAR:'Ярус VIII'}],
 PIAP:[{KIAR:1},{KIAR:8}],
 SDP:[{KPC:'К',NDP:'Кедр',DKP2:101000},{KPC:'В',NDP:'Вяз',DKP2:202500,ОбПор:'В'},{KPC:'Б',NDP:'Берёза',DKP2:302600,ОбПор:'Б'},
      {KPC:'ТВ',NDP:'Таволга',DKP2:825500,ОбПор:'КУСТ'}],
 SDP_Tip:[{KPC:'В',NDP:'Вяз',DKP2:202500},{KPC:'Б',NDP:'Берёза',DKP2:302600},
          {KPC:'ТВ',NDP:'Таволга',DKP2:825500}],
 STL:[{GPor:'В',Lxz:8,OblStl:15,GrTL:0,KTL:'ВРТЗ',NTL:'Вязовник'},
      {GPor:'Б',Lxz:8,OblStl:15,GrTL:0,KTL:'БРТЗ',NTL:'Берёзовник'}],
 SLM:[{KM:0,PM2R:0,NMR:'Нет'},{KM:10,PM2R:1,NMR:'Первое'},
      {KM:20,PM2R:2,NMR:'Второе'}],
 SSP:[{KSP:0,K84:0,NSP:'Нет'},{KSP:1,K84:0,NSP:'Обычная'},
      {KSP:2,K84:1,NSP:'KTP 84'}],
 SBR:[{KB:1,NB:'Вредитель1'},{KB:2,NB:'Вредитель2'}],
 SOV:[{KOV:0,Priz:0},{KOV:205,Priz:1},{KOV:206,Priz:0},{KOV:207,Priz:0}]
};
const clone=x=>JSON.parse(JSON.stringify(x));
const old={
 KU:2,M3Pr:'В',M3TLU:'ВРТЗ',NE2A:0,KlxrVD:8,
 M2PM1:10,M22:20,M23:0,PRP1:'В',PRP2:'Б',PLP1:'ТВ',
 _children:{
  Макет10:[{IAR:1,POR:'В',ZAP:40}],
  Макет16:[{Por16:'В'}],
  Макет12:[{KTP:84,SV:2,VV:1,VB:2}],
  Макет23:[{K1:205,K2:206}]
 }
};
const audit=(prior,after,options={})=>rules.validateTransition(prior,after,org,refs,options);
const reject=(prior,after,form,field)=>{
 const snap=JSON.stringify(after),result=audit(prior,after);
 assert(result.errors.some(x=>x.form===form&&x.field===field),
   'Expected '+form+'.'+field+' error: '+JSON.stringify(result));
 assert.equal(JSON.stringify(after),snap,'Validator must never mutate the card');
 return result;
};
assert.equal(audit(old,clone(old)).errors.length,0,'Unchanged imported source stays intact');
let next=clone(old);next.M2PM1=999;reject(old,next,'ВыделВ','M2PM1');
next=clone(old);next.PRP1='ТВ';reject(old,next,'ВыделВ','PRP1');
next=clone(old);next.PLP1='В';reject(old,next,'ВыделВ','PLP1');
next=clone(old);next.M3Pr='Б';reject(old,next,'ВыделВ','M3TLU');
next=clone(old);next.KU=2;next._children.Макет10[0].IAR=4;
reject(old,next,'Макет10','IAR');
next=clone(old);next._children.Макет10[0].POR='Б';
reject(old,next,'Макет16','Por16');
next=clone(old);next._children.Макет10=[];
reject(old,next,'Макет16','Por16');
next=clone(old);next._children.Макет10[0].POR='Б';
next._children.Макет10[0]={IAR:1,POR:'К',KOEF:3,LET:100,POL:.6};
next._children.Макет16[0].Por16='К';
assert.equal(audit(old,next).errors.length,0,'Simultaneous consistent two-maket update allowed');
next=clone(old);next._children.Макет12[0].KTP=3;
reject(old,next,'Макет12','SV');
next=clone(old);next._children.Макет23[0].K2=205;
reject(old,next,'Макет23','K2');
const legacy=clone(old);legacy._children.Макет16[0].Por16='XXX';
const updated=clone(legacy);updated._children.Макет10[0].ZAP=50;
assert.equal(audit(legacy,updated).errors.length,0,
 'Unchanged imported inconsistency should not block unrelated ZAP edit');
const incomplete={...refs,STL:[]};
const missing=rules.validateTransition(old,{...clone(old),M3Pr:'Б'},org,incomplete);
assert(missing.warnings.some(x=>x.field==='M3TLU'),
 'Missing original reference should yield an explicit warning, not a false validation');
for(const [file,marker] of [
 ['solin-workflow.js','validateTransition?.('],
 ['solin-card-editor.js','engine.validateTransition?.(']
])assert(fs.readFileSync(file,'utf8').includes(marker),file+' must use shared card audit');
console.log('WHOLE_CARD_DEPENDENCY_OK: 11 edit/delete/save cases, multiple Makets, imported legacy, missing source warnings');
