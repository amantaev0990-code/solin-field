/* SOLI-N category rules: source-backed, fail-safe interpretation of KU.
 * The 123 SKU names are catalog entries, NOT 123 proven form requirements.
 * Keep all original MDB column names and values unchanged.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.SolinCategoryRules=api;
})(typeof window!=='undefined'?window:undefined,function(){
 'use strict';
 const code=value=>{
  if(value==null||String(value).trim()==='')return null;
  const n=Number(value);return Number.isSafeInteger(n)?n:null;
 };
 const num=value=>{
  if(value==null||String(value).trim()==='')return null;
  const n=Number(String(value).replace(',','.'));return Number.isFinite(n)?n:null;
 };
 const refs=given=>given||((typeof window!=='undefined'&&window.SOLIN_REFS?.tables)||{});
 // Sources: original SKU fields KU,NKU,P10,GrMak,KLF. Compact refs/SKU.json
 // includes only KU,NKU. Missing columns MUST remain unknown, never zero.
 function profile(ku,given){
  const id=code(ku);
  if(id==null)return {status:'waiting',reason:'Сначала выберите категорию угодий',code:null};
  const source=refs(given),row=(source.SKU||[]).find(x=>code(x.KU)===id);
  if(!row)return {status:source.SKU?'unknown':'unavailable',code:id,
   reason:source.SKU?'Код не найден в исходном SKU':'Не загружен справочник SKU'};
  const group=code(row.P10),maketGroup=code(row.GrMak),forestGroup=code(row.KLF);
  // Exact original KU RowSource columns:
  // KU,NKU,KLF,PN,P31,P10,PM,GrMak,PF1. These flags are exposed as
  // metadata, never treated as a decoded mandatory-maket list.
  const makerFlag=code(row.PM),form1=code(row.PF1),p31=code(row.P31),pn=code(row.PN);
  return {status:group==null?'partial':'verified-reference',
   code:id,name:String(row.NKU||''),group,maketGroup,forestGroup,
   makerFlag,form1,p31,pn,fireCategory:code(row.Kpoj),
   kpol:code(row.KPOL),landscape:code(row.Land),
   hasTreeLayers:group==null?null:group!==0,
   reason:group==null?'Из SKU известна категория, но не загружена исходная группа ярусов P10':
     'Источник: SKU.P10; возможные ярусы уточняются через SIAR/PIAP'};
 }
 // Only interpretation confirmed independently by the original Access rule
 // Макет10.POL >=0 AND <=1 OR >25 AND <101 and explicit KU=19 observation.
 // The other 122 categories must NOT inherit a guessed "survival" semantics.
 function field(ku,form,name,given){
  const p=profile(ku,given);
  if(form==='Макет10'&&name==='ZAP'&&p.code===19)
   return {kind:'not-applicable',status:'confirmed',
    label:'Запас — не заполняется для KU 19',valueForNewRecord:0,profile:p,
    evidence:'Руководство SOLI-N, Макет 10: для несомкнувшихся лесных культур запас не проставляется; исходные Transfer KU19 ZAP=0'};
  if(form!=='Макет10'||name!=='POL')return {kind:'unspecified',status:'unverified',label:name,profile:p};
  if(p.code===19)return {kind:'survival',status:'confirmed',
   label:'Приживаемость, %',min:1,max:100,step:1,
   desktopAcceptedMin:26,profile:p,
   evidence:'Оригинальная форма Макет10.POL (>25 и <101); KU 19 — несомкнувшиеся лесные культуры'};
  if(p.hasTreeLayers===false)return {kind:'not-applicable',status:'verified-reference',
   label:'POL (не применяется без ярусов)',profile:p};
  // The original ordinary stand category (1..10) uses fractional fullness.
  // Do not extend this range to burns, hayfields, bogs or other KU values
  // just because the MDB column shares the same name.
  if(p.code!=null&&p.code>=1&&p.code<=10)
   return {kind:'fullness',status:'confirmed',label:'Полнота',
    min:0.1,max:1,step:0.1,profile:p,
    evidence:'Оригинальный Макет10.POL, относительная полнота для древесных насаждений'};
  return {kind:'unverified',status:'unverified',
   label:'POL — значение уточняется',profile:p,
   evidence:'Один столбец POL использует разные шкалы; семантика этой категории не подтверждена'};
 }
 function validatePol(ku,value,given){
  const rule=field(ku,'Макет10','POL',given);
  if(value==null||String(value).trim()==='')return {status:'empty',rule};
  const n=num(value);
  if(n==null)return {status:'error',rule,message:rule.label+': введите число'};
  if(rule.kind==='survival'){
   if(!Number.isInteger(n)||n<1||n>100)
    return {status:'error',rule,message:'Приживаемость: целое число от 1 до 100 %'};
   if(n<26)return {status:'warning',rule,
    message:'Приживаемость '+n+' % введена, но оригинальный контроль Access для Макета 10 допускает 26–100 %. Проверьте категорию и исходные данные.'};
   return {status:'ok',rule};
  }
  if(rule.kind==='fullness'){
   if(n<0||n>1)return {status:'error',rule,message:'Полнота должна быть от 0 до 1,0'};
   return {status:'ok',rule};
  }
  if(rule.kind==='not-applicable')
   return {status:'warning',rule,message:'Макет 10 не предусмотрен исходной группой ярусов SKU.P10=0; сохранённые записи не удаляются.'};
  // Unclassified category: warn, not make up a wrong 0.1..1.0 rule.
  // The generic original Access POL validation is still available to control.
  if(n<0||n>100)
   return {status:'error',rule,message:'Значение POL выходит за исходный допустимый диапазон 0–100.'};
  if(n>1&&n<=25)
   return {status:'warning',rule,message:'Значение POL может не пройти оригинальный контроль (допустимо 0–1 либо 26–100); назначение поля для этой категории не подтверждено.'};
  return {status:'unverified',rule,message:'Требуется проверка назначения POL по оригинальной форме выбранной категории.'};
 }
 // Original Access expressions select [PjN] for particular Klxr=N.
 // The numeric Pj value's user-facing meaning is NOT decoded yet, so return
 // the raw source attribute only. Never automatically set a control from it.
 function zoneAttribute(ku,klxr,given){
  const zone=code(klxr),p=profile(ku,given);
  if(zone==null||p.code==null)return {status:'waiting',source:null};
  const name='Pj'+zone;
  const row=(refs(given).SKU||[]).find(x=>code(x.KU)===p.code);
  if(!row||!Object.prototype.hasOwnProperty.call(row,name))
   return {status:'unavailable',source:name,reason:'Зональный признак не найден в исходном SKU'};
  return {status:'source-value',source:'SKU.'+name,value:code(row[name]),
   baseline:code(row.Kpoj),category:p.code,zone,
   verifiedMeaning:false,reason:'Исходное выражение Access использует PjN для Klxr=N; назначение числового кода требует подтверждения'};
 }
 function guide(ku,given){
  const p=profile(ku,given);
  if(p.status==='waiting'||p.status==='unknown'||p.status==='unavailable')return p.reason;
  const layers=p.hasTreeLayers===false?'Ярусы древостоя не предусмотрены':p.hasTreeLayers===true?
   'Группа ярусов P10='+p.group:'Группа ярусов ещё не установлена';
  const makets=p.maketGroup==null?'группа макетов не подтверждена':'группа макетов GrMak='+p.maketGroup;
  const pol=field(ku,'Макет10','POL',given);
  const meaning=pol.kind==='survival'?'POL: приживаемость в процентах':
    pol.kind==='fullness'?'POL: относительная полнота':
    pol.kind==='not-applicable'?'POL: нет ярусов древостоя':
    'POL: назначение требует проверки';
  return 'Категория '+p.code+' — '+p.name+'. '+layers+'; '+makets+'. '+meaning+
   '. Другие обязательные макеты и поля проверяются по оригинальному SOLI-N.';
 }
 return Object.freeze({profile,field,validatePol,guide,zoneAttribute});
});