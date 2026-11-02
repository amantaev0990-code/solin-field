/* Audited dependent inputs from SOLI-N Access form RowSource SQL.
 * Read-only reference filtering. Never normalize persisted source codes or
 * mutate imported MDB records. Unknown context remains UNKNOWN, not valid.
 * Source: original Solim.mdb, ВыделВ M3TLU/M22/M23/PRP/PLP and Макет23.
 */
(()=>{'use strict';
const filled=v=>v!==null&&v!==undefined&&String(v)!=='';
const code=v=>String(v??'').trim();
const num=v=>filled(v)&&code(v)!==''&&Number.isFinite(Number(v))?Number(v):null;
const same=(a,b)=>filled(a)&&filled(b)&&code(a)===code(b);
const ref=()=>window.SOLIN_REFS?.tables||null;
const name=r=>String(r?.NTL??r?.NDP??r?.NOV??r?.NMR??'');
function kto(org){
 const direct=Number(org?.KTO);
 if(Number.isFinite(direct)&&direct>0)return direct;
 return window.SolinAddressContext?.originalKTO?.(org?.POS,org?.LESN)??null;
}
function region(org){
 const raw=kto(org);
 const value=raw/10000000; // Original query ВыделЛес.KTOKR.
 return Number.isInteger(value)&&value>0?value:null;
}
function speciesGroup(primary,refs){
 if(!filled(primary))return null;
 const s=(refs?.SDP_Tip||[]).find(r=>same(r.KPC,primary)&&filled(r['ОбПор']))||
   (refs?.SDP||[]).find(r=>same(r.KPC,primary));
 return s&&filled(s['ОбПор'])?String(s['ОбПор']):null;
}
function forestTypes(card,org,refs=ref()){
 const species=card?.M3Pr,zone=card?.KlxrVD,area=region(org),group=speciesGroup(species,refs);
 if(!refs?.STL?.length)return {status:'unavailable',reason:'Справочник STL ещё не загружен',items:[]};
 if(!filled(species))return {status:'waiting',reason:'Сначала выберите главную породу',items:[]};
 if(group===null)return {status:'unavailable',reason:'Не найден род породы в SDP',items:[]};
 if(!filled(zone)||area===null)return {status:'unavailable',reason:'Не определена лесохозяйственная зона или код области',items:[]};
 const matches=refs.STL.filter(r=>filled(r.KTL)&&same(r.GPor,group)&&same(r.Lxz,zone)&&same(r.OblStl,area));
 if(!matches.length)return {status:'empty',reason:'Для породы, зоны и области в STL нет типов леса',items:[],group,zone,area};
 const groups=[...new Set(matches.map(r=>code(r.GrTL)))];
 // NE2A is a real additional source field; if absent, do not invent it.
 const groupKnown=filled(card.NE2A);
 const ambiguous=!groupKnown&&groups.length>1;
 const selected=ambiguous?[]:groupKnown?matches.filter(r=>same(r.GrTL,card.NE2A)):matches;
 const items=selected.map(r=>({value:String(r.KTL??''),label:name(r),group:r.GrTL,area:r.OblStl,zone:r.Lxz}));
 const status=ambiguous?'ambiguous':groupKnown?'complete':'partial';
 const reason=ambiguous?'Уточните группу типа леса NE2A: в этой зоне существуют разные группы':groupKnown?
  'Точный фильтр SOLI-N: порода, зона, группа, область':
  'В данном сочетании STL имеет одну группу; NE2A в карточке не заполнено';
 return {status,reason,items,group,zone,area,groups};
}
// Original ВыделВ.KU rowsource contains SKU.P10 (position 5) and
// Макет10.IAR RowSource uses SIAR.Ia = Forms!ВыделВ!NM1.
// P10 is the category-level IAR group; zero means no tree layers.
function landCategory(card,refs=ref()){
 if(!filled(card?.KU))return {status:'waiting',reason:'Сначала укажите категорию угодий'};
 if(!refs?.SKU)return {status:'unavailable',reason:'Справочник категорий SKU недоступен'};
 const found=refs.SKU.find(r=>same(r.KU,card.KU));
 if(!found)return {status:'unknown',reason:'Категория угодий отсутствует в SKU'};
 const group=num(found.P10);
 if(group===null)return {status:'unknown',reason:'Для категории не определена группа ярусов P10'};
 return {status:'complete',category:String(found.KU),name:String(found.NKU??''),group,maketGroup:num(found.GrMak),forestGroup:num(found.KLF)};
}
function allowedLayers(card,refs=ref()){
 const c=landCategory(card,refs);
 if(c.status!=='complete')return {...c,items:[]};
 if(!refs?.SIAR?.length||!refs?.PIAP?.length)
  return {status:'unavailable',reason:'Не загружены исходные таблицы SIAR / PIAP',items:[]};
 const joined=new Set(refs.PIAP.filter(r=>filled(r.KIAR)).map(r=>code(r.KIAR)));
 const items=refs.SIAR.filter(r=>same(r.Ia,c.group)&&joined.has(code(r.KIAR))&&filled(r.NIAR))
  .map(r=>({value:String(r.KIAR),label:String(r.NIAR)}));
 return {status:'complete',reason:'Группа P10='+c.group+' категории «'+c.name+'» → SIAR.Ia → PIAP.KIAR',
  items,category:c.category,categoryName:c.name,group:c.group,notApplicable:c.group===0};
}
function suggestedOrigin(species,refs=ref()){
 const physical=(refs?.SDP||[]).find(r=>same(r.KPC,species));
 if(!physical||!filled(physical['ОбПор']))return null;
 // Original SOLI-N manual: auto-origin except birch, where it is manual.
 if(code(physical['ОбПор']).toLocaleUpperCase('ru')==='Б')return null;
 if(!filled(physical['Происхож']))return null;
 const v=Number(physical['Происхож']);
 return Number.isFinite(v)?v:null;
}
function distinctOptions(table,field,allowed,excluded=[]){
 return (table||[]).filter(r=>allowed(r)&&!excluded.some(v=>filled(v)&&same(r[field],v)));
}
function options(form,field,row,card,org,refs=ref()){
 if(form==='Макет10'&&field==='IAR')return allowedLayers(card,refs);
 if(form==='ВыделВ'&&field==='M3TLU'){
  const r=forestTypes(card,org,refs);
  return {status:r.status,reason:r.reason,items:r.items};
 }
 if(form==='ВыделВ'&&field==='M3Pr'){
  if(!refs?.SDP_Tip?.length)
   return {status:'unavailable',reason:'Исходный список пород SDP_Tip отсутствует — выбор не подтверждён',items:[]};
  // Original ВыделВ main-species RowSource explicitly excludes "КУСТ".
  return {status:'complete',reason:'Оригинальный список главной породы исключает КУСТ',
   items:refs.SDP_Tip.filter(r=>filled(r.KPC)&&code(r.KPC)!=='КУСТ')
    .map(r=>({value:String(r.KPC),label:String(r.NDP||'')}))};
 }
 if(!refs)return {status:'unavailable',reason:'Справочники ещё не загружены',items:[]};
 if(form==='Квартал'&&field==='Kpz'){
  if(!Array.isArray(refs.Spzon)||!refs.Spzon.length)
   return {status:'unavailable',reason:'Нет исходной таблицы природных зон Spzon',items:[]};
  const items=refs.Spzon.filter(r=>filled(r.Kpz)).map(r=>
   ({value:code(r.Kpz),label:String(r.Npz??'')}));
  return {status:'complete',reason:'Природные зоны из исходного Spzon.Kpz',items};
 }
 if(form==='Квартал'&&field==='KGLF'){
  if(!Array.isArray(refs.Sples)||!refs.Sples.length)
   return {status:'unavailable',reason:'Исходный справочник Sples недоступен; категории ГЛФ нельзя фильтровать наугад',items:[]};
  const items=refs.Sples.filter(r=>filled(r.KOD)&&num(r.PR)>0)
   .map(r=>({value:code(r.KOD),label:String(r.T1??'')}));
  return {status:'complete',reason:'Оригинальная строка выбора: Sples.PR > 0',items};
 }
 // Original Квартал.Fzona RowSource starts with SFZ.KLF joined to
 // Forms!Квартал!KGLF. The exported WHERE is truncated, so these are
 // *source-associated candidates*, not a complete claim of Access parity.
 if(form==='Квартал'&&field==='Fzona'){
  if(!filled(row?.KGLF))return {status:'waiting',reason:'Сначала выберите КГЛФ квартала',items:[]};
  if(!refs?.SFZ?.length)return {status:'unavailable',reason:'Исходный справочник SFZ не загружен',items:[]};
  const matches=refs.SFZ.filter(r=>num(r.KLF)>0&&same(r.KLF,row.KGLF)&&num(r.KFZ)>0);
  if(!matches.length)return {status:'unavailable',
   reason:'Для КГЛФ '+code(row.KGLF)+' справочник SFZ не содержит однозначной связки KLF. Условие Access WHERE не восстановлено; не подставляем функциональную зону.',
   items:[]};
  const unique=new Map();
  for(const entry of matches)if(!unique.has(code(entry.KFZ)))
   unique.set(code(entry.KFZ),{value:code(entry.KFZ),label:String(entry.NFZK||entry.NFZ||'')});
  return {status:'partial',reason:'Подтверждена связь SFZ.KLF='+code(row.KGLF)+
   ' с KFZ. Оставшаяся часть Access WHERE не восстановлена — варианты требуют сверки.',
   items:[...unique.values()]};
 }
 // Кл_Рай отсутствует в сохранённом нормативном пакете. Не показываем
 // произвольные районы другой области и не выдаём чужие коды за верные.
 if(form==='Квартал'&&field==='Raion'){
  return {status:'unavailable',reason:'Исходная таблица «Кл_Рай» и полный фильтр ТЕОб не сохранены. Район нельзя подтвердить без первоисточника.',items:[]};
 }
 if(form==='Квартал'&&field==='Klxr'){
  if(!filled(row?.Kpz))return {status:'waiting',reason:'Сначала укажите природную зону Kpz квартала',items:[]};
  if(!Array.isArray(refs.Slxr)||!refs.Slxr.length||!Array.isArray(refs.Szap)||!refs.Szap.length)
   return {status:'unavailable',reason:'Требуются исходные таблицы Slxr и Szap; общий список не является допустимым',items:[]};
  const obl=kto(org);
  if(!obl)return {status:'unavailable',reason:'Сначала определите код области KTO лесничества',items:[]};
  const allowed=new Set(refs.Szap.filter(r=>same(r.Obl,obl)&&filled(r.LXZ)).map(r=>code(r.LXZ)));
  if(!allowed.size)return {status:'unavailable',reason:'Для KTO '+obl+' отсутствуют нормативные зоны Szap',items:[]};
  const found=new Map();
  for(const r of refs.Slxr){
   if(!filled(r.Klxz)||same(r.Klxz,0)||!same(r.Kpz,row.Kpz)||!allowed.has(code(r.Klxz)))continue;
   const key=code(r.Klxz);
   if(!found.has(key))found.set(key,{value:key,label:String(r.Nlxr||'')});
  }
  const items=[...found.values()];
  return {status:items.length?'complete':'empty',
   reason:'Slxr.Kpz='+code(row.Kpz)+' ∩ Szap.Obl='+obl+' (LXZ): '+(items.map(x=>x.value).join(', ')||'совпадений нет'),
   items,dependencies:['Kpz','KTO'],region:obl};
 }
 // In Access, Макет17.P17 and Макет19.ZP share SDP RowSources:
 // "DKP2 = 0 Or DKP2 > 70..." (truncated archive). Only the
 // indisputable broad prerequisite >70 is used. This is NOT the final
 // threshold (which may have more digits) and must never be accepted
 // automatically as proof that a code is allowed in the original form.
 if((form==='Макет17'&&field==='P17')||(form==='Макет19'&&field==='ZP')){
  if(!refs?.SDP?.length)return {status:'unavailable',
   reason:'Нет исходного справочника SDP для породы макета',items:[]};
  const subset=refs.SDP.filter(r=>filled(r.KPC)&&
   (num(r.DKP2)===0||num(r.DKP2)>70));
  const byCode=new Map();
  for(const r of subset)if(!byCode.has(code(r.KPC)))
   byCode.set(code(r.KPC),{value:code(r.KPC),label:String(r.NDP||'')});
  return {status:'partial',items:[...byCode.values()],
   reason:'Оригинальный SQL: SDP.DKP2 = 0 OR SDP.DKP2 > 70…; конец порога не сохранился. Список предварительный, соответствие настольному SOLI-N не подтверждено.'};
 }
 if(form==='Макет16'&&field==='Por16'){
  // Original RowSource reads Maket10Выд.POR for this same stand.
  const stems=card?._children?.['Макет10']||[],used=new Set(stems.map(r=>code(r.POR)).filter(Boolean));
  if(!used.size)return {status:'waiting',reason:'Сначала укажите состав древостоя в макете 10',items:[]};
  return {status:'complete',reason:'Породы макета 16 берутся из древостоя этого выдела',items:[...used].map(k=>({value:k,label:refs.SDP?.find(r=>same(r.KPC,k))?.NDP||k}))};
 }
 if(form==='Макет12'&&['SV','SB'].includes(field)){
  if(!refs?.SSP?.length)
   return {status:'unavailable',reason:'Нет исходного SSP для проверки степени повреждения',items:[]};
  const level=field==='SV'&&same(row.KTP,84)?1:0;
  return {status:'complete',reason:field==='SV'?'Степень повреждения зависит от типа повреждения (84 / другое)':'Вторая степень по группе K84=0',
   items:refs.SSP.filter(r=>filled(r.KSP)&&(field==='SV'?same(r.KSP,0)||num(r.K84)===level:num(r.K84)===0))
    .map(r=>({value:String(r.KSP),label:String(r.NSP||'')}))};
 }
 if(form==='Макет12'&&['VV','VB'].includes(field)){
  if(!refs?.SBR?.length)
   return {status:'unavailable',reason:'Нет исходного SBR; выбор вредителя и болезни не подтверждён',items:[]};
  const exclude=field==='VV'?row.VB:row.VV;
  // Access also filters by computed Признак; its origin is not proven here.
  return {status:'partial',reason:'Виды не должны повторяться. Признак вредителя требует проверки исходного Access.',items:refs.SBR.filter(r=>filled(r.KB)&&(!filled(exclude)||!same(r.KB,exclude))).map(r=>({value:String(r.KB),label:String(r.NB||'')}))};
 }
 if(form==='ВыделВ'&&['M2PM1','M22','M23'].includes(field)){
  if(!refs?.SLM?.length)
   return {status:'unavailable',reason:'Нет оригинального SLM для выбора хозяйственных мероприятий',items:[]};
  const prev=field==='M22'?[row.M2PM1]:field==='M23'?[row.M2PM1,row.M22]:[];
  const previousReady=field==='M2PM1'||(field==='M22'?filled(row.M2PM1)&&code(row.M2PM1)!=='0':filled(row.M22)&&code(row.M22)!=='0');
  const items=refs.SLM.filter(r=>filled(r.KM)&&(same(r.KM,0)||(
    previousReady && !prev.some(v=>same(v,r.KM)) && (
      field==='M2PM1'?[0,1,2].includes(num(r.PM2R)):[0,2].includes(num(r.PM2R))
    )
  ))).map(r=>({value:String(r.KM),label:String(r.NMR||'')}));
  return {status:'complete',reason:'Последовательность мероприятий по SLM.PM2R',items};
 }
 if(form==='ВыделВ'&&/^PRP[123]$/.test(field)){
  if(!refs?.SDP_Tip?.length)
   return {status:'unavailable',reason:'Нет оригинальной SDP_Tip для пород подроста',items:[]};
  const i=Number(field.slice(-1));
  const already=i===1?[]:i===2?[row.PRP1]:[row.PRP1,row.PRP2];
  const ready=i===1||(filled(row['PRP'+(i-1)])&&code(row['PRP'+(i-1)])!=='0');
  const rows=distinctOptions(refs.SDP_Tip,'KPC',r=>num(r.DKP2)!==null&&num(r.DKP2)<700000,already);
  return {status:'complete',reason:'Породы подроста без повторений (SDP_Tip.DKP2)',items:ready?rows.map(r=>({value:String(r.KPC),label:String(r.NDP||'')})):[]};
 }
 if(form==='ВыделВ'&&/^PLP[123]$/.test(field)){
  if(!refs?.SDP?.length)
   return {status:'unavailable',reason:'Нет оригинальной SDP для пород подлеска',items:[]};
  const i=Number(field.slice(-1));
  const already=i===1?[]:i===2?[row.PLP1]:[row.PLP1,row.PLP2];
  const ready=i===1||(filled(row['PLP'+(i-1)])&&code(row['PLP'+(i-1)])!=='0');
  const rows=distinctOptions(refs.SDP,'KPC',r=>num(r.DKP2)!==null&&(num(r.DKP2)>700000||num(r.DKP2)===0),already);
  return {status:'complete',reason:'Породы подлеска без повторений (SDP.DKP2)',items:ready?rows.map(r=>({value:String(r.KPC),label:String(r.NDP||'')})):[]};
 }
 if(form==='Макет23'&&/^K[1-8]$/.test(field)){
  if(!refs?.SOV?.length)
   return {status:'unavailable',reason:'Нет оригинального SOV для особенностей выдела',items:[]};
  const i=Number(field.slice(1)),previous=Array.from({length:i-1},(_,j)=>row['K'+(j+1)]);
  const ready=i===1||(filled(previous.at(-1))&&code(previous.at(-1))!=='0');
  const rows=refs.SOV.filter(r=>filled(r.KOV)&&(i===1?num(r.KOV)!==135&&[0,1].includes(num(r.Priz)):num(r.Priz)===0))
    .filter(r=>!previous.some(v=>same(v,r.KOV)));
  // Access K8 contains a malformed literal "And"; do not claim exact VBA parity.
  return {status:i===8?'partial':'complete',reason:'Последовательные уникальные особенности SOV',items:ready?rows.map(r=>({value:String(r.KOV),label:String(r.NOV||'')})):[]};
 }
 return null;
}
// Shared UI adapter for every form: never display the unrestricted SolinHuman
// lookup after a verified Access RowSource has reduced the permitted choices.
// Existing imported codes remain visible but are not advertised as permitted.
// This audit is shared by the full editor and individual Maket editors.
// Only newly edited tree composition should be checked against related makets;
// unchanged imported records remain intact.
function treeDependencies(card,refs=ref()){
 const issues=[],rows=card?._children?.['Макет10']||[];
 const layers=allowedLayers(card,refs);
 if(layers.status==='complete')for(let i=0;i<rows.length;i++){
  const value=rows[i]?.IAR;
  if(!filled(value)||code(value)==='0')continue;
  if(currentIsAllowed(value,layers)===false)issues.push({
   form:'Макет10',field:'IAR',index:i,value:code(value),
   reason:'Ярус '+code(value)+' не разрешён для категории угодий '+code(card?.KU)+
     ' по SKU.P10 → SIAR.Ia → PIAP.KIAR'
  });
 }
 const material=card?._children?.['Макет16']||[];
 if(material.length){
  const allowed=options('Макет16','Por16',{},card,null,refs);
  for(let i=0;i<material.length;i++){
   const value=material[i]?.Por16;
   if(!filled(value)||code(value)==='0')continue;
   if(allowed?.status==='waiting'||currentIsAllowed(value,allowed)===false)issues.push({
    form:'Макет16',field:'Por16',index:i,value:code(value),
    reason:'Порода '+code(value)+' из макета 16 отсутствует в составе макета 10 текущего выдела'
   });
  }
 }
 return issues;
}
// Audit a whole card transition instead of validating only the currently
// open form. The same source rules apply to edit, delete and Save. Unchanged
// legacy/imported values do not block an unrelated correction.
const BASE_CHAIN={
 M3Pr:['M3Pr'],
 M3TLU:['M3Pr','M3TLU','KlxrVD','NE2A'],
 M2PM1:['M2PM1'],M22:['M2PM1','M22'],M23:['M2PM1','M22','M23'],
 PRP1:['PRP1'],PRP2:['PRP1','PRP2'],PRP3:['PRP1','PRP2','PRP3'],
 PLP1:['PLP1'],PLP2:['PLP1','PLP2'],PLP3:['PLP1','PLP2','PLP3']
};
const MAKET_CHAIN={
 'Макет10':{IAR:['IAR','KU']},
 'Макет12':{SV:['KTP','SV'],SB:['SB'],VV:['VV','VB'],VB:['VV','VB']},
 'Макет16':{Por16:['Por16','Макет10']},
 'Макет23':Object.fromEntries(Array.from({length:8},(_,i)=>[
  'K'+(i+1),Array.from({length:i+1},(_,j)=>'K'+(j+1))
 ]))
};
const changedValue=(a,b)=>code(a)!==code(b);
const treeKey=x=>[x.form,x.field,x.index,x.value].join('|');
function validateTransition(before,after,org,refs=ref(),opts={}){
 const errors=[],warnings=[];
 if(!after)return {errors:[{reason:'Не передана карточка для контроля'}],warnings};
 const isNew=!before||opts.isNew===true;
 const baseDirty=deps=>isNew||deps.some(k=>changedValue(before?.[k],after[k]));
 const changedRow=(a,b,deps)=>isNew||!a||
  deps.some(k=>changedValue(a[k],b[k]));
 const issue=(form,field,index,value,reason,unknown=false)=>{
  (unknown?warnings:errors).push({form,field,index,value:code(value),reason});
 };
 const inspect=(form,field,row,index,enabled)=>{
  if(!enabled||!filled(row?.[field]))return;
  const result=options(form,field,row,after,org,refs);
  if(!result)return; // No source-backed RowSource for this field yet.
  const valid=currentIsAllowed(row[field],result);
  if(valid===false&&['complete','empty'].includes(result.status))
   issue(form,field,index,row[field],
    form+'.'+field+': код '+code(row[field])+' не входит в разрешённые значения. '+(result.reason||''));
  else if(result.status==='partial'||result.status==='ambiguous'||
          (valid===null&&['waiting','unavailable','unknown'].includes(result.status)))
   issue(form,field,index,row[field],
    form+'.'+field+': зависимость пока не подтверждена полностью. '+(result.reason||''),true);
 };
 for(const [field,deps] of Object.entries(BASE_CHAIN))
  inspect('ВыделВ',field,after,null,baseDirty(deps));
 const beforeChildren=before?._children||{},children=after._children||{};
 const maket10Changed=JSON.stringify(beforeChildren.Макет10||[])!==
   JSON.stringify(children.Макет10||[]);
 // Stock ZAP, height and density changes do not change the pool of
 // available Por16 species. Only the actual composition should retrigger
 // a previously imported Maket16 species value.
 const speciesSignature=rows=>[...new Set((rows||[]).map(r=>code(r.POR)).filter(Boolean))]
   .sort().join('|');
 const maket10SpeciesChanged=speciesSignature(beforeChildren.Макет10)!==
   speciesSignature(children.Макет10);
 const kuChanged=baseDirty(['KU']);
 for(const [form,fields] of Object.entries(MAKET_CHAIN)){
  const rows=children[form]||[],oldRows=beforeChildren[form]||[];
  for(let i=0;i<rows.length;i++){
   for(const [field,deps] of Object.entries(fields)){
    const row=rows[i],prior=oldRows[i];
    const upstream=form==='Макет10'&&kuChanged||
      form==='Макет16'&&maket10SpeciesChanged;
    inspect(form,field,row,i,upstream||changedRow(prior,row,deps));
   }
  }
 }
 // Match only newly introduced cross-form conflicts. This prevents an old
 // imported inconsistency from blocking unrelated edits.
 if(isNew||kuChanged||maket10Changed||
    JSON.stringify(beforeChildren.Макет16||[])!==JSON.stringify(children.Макет16||[])){
  const existing=new Set(before?treeDependencies(before,refs).map(treeKey):[]);
  for(const found of treeDependencies(after,refs)){
   if(existing.has(treeKey(found)))continue;
   if(!errors.some(e=>e.form===found.form&&e.field===found.field&&e.index===found.index))
    errors.push(found);
  }
 }
 return {errors,warnings};
}
function applySelect(select,result,opts={}){
 if(!select||!result)return null;
 const old=String(opts.current??select.value??'');
 let input=select;
 if(input.tagName!=='SELECT'){
  if(input.tagName!=='INPUT'||!input.parentElement)return null;
  const replacement=document.createElement('select');
  for(const attr of input.attributes){
   if(!['type','inputmode','list','value','placeholder','autocomplete'].includes(attr.name))
    replacement.setAttribute(attr.name,attr.value);
  }
  input.replaceWith(replacement);input=replacement;
 }
 const status=result.status||'unavailable';
 const ready=['complete','partial'].includes(status);
 const items=ready?(result.items||[]):[];
 const seen=new Set();
 const options=[new Option('— Не указано —','')];
 for(const item of items){
  const val=String(item.value??'');
  if(!val||seen.has(val))continue;
  seen.add(val);
  options.push(new Option(val+(item.label?' — '+item.label:''),val));
 }
 const has=old&&seen.has(old);
 if(old&&!has){
  const saved=new Option('Сохранённый, сейчас недопустимый: '+old,old);
  saved.disabled=true;options.push(saved);
 }
 const signature=status+'|'+options.map(o=>o.value+'='+o.textContent).join(';');
 if(input.dataset.dependentSignature!==signature){
  input.replaceChildren(...options);
  input.dataset.dependentSignature=signature;
 }
 input.value=old;
 input.disabled=!ready;
 input.dataset.dependentStatus=status;
 input.dataset.dependentAllowed=old&&!has?'false':'true';
 input.title=result.reason||'';
 return input;
}
function currentIsAllowed(value,result){
 if(!result||result.status==='waiting'||result.status==='unavailable')return null;
 if(!filled(value))return null;
 if(code(value)==='0' && !result.items.some(r=>same(r.value,0)))return null;
 return result.items.some(r=>same(r.value,value));
}
window.SolinDependentRules={forestTypes,options,currentIsAllowed,applySelect,treeDependencies,validateTransition,kto,region,speciesGroup,suggestedOrigin,landCategory,allowedLayers};
})();
