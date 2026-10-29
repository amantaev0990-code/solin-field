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
function region(org){
 const raw=Number(org?.KTO);
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
 if(form==='ВыделВ'&&field==='M3TLU'){
  const r=forestTypes(card,org,refs);
  return {status:r.status,reason:r.reason,items:r.items};
 }
 if(!refs)return {status:'unavailable',reason:'Справочники ещё не загружены',items:[]};
 if(form==='Квартал'&&field==='Klxr'&&refs.Slxr){
  if(!filled(row.Kpz))return {status:'waiting',reason:'Выберите природную зону квартала',items:[]};
  return {status:'complete',reason:'Секции Slxr зависят от природной зоны квартала',items:refs.Slxr.filter(r=>filled(r.Klxz)&&same(r.Kpz,row.Kpz)&&!same(r.Klxz,0)).map(r=>({value:String(r.Klxz),label:String(r.Nlxr||'')}))};
 }
 if(form==='Макет12'&&['VV','VB'].includes(field)&&refs.SBR){
  const exclude=field==='VV'?row.VB:row.VV;
  // Access also filters by computed Признак; its origin is not proven here.
  return {status:'partial',reason:'Виды не должны повторяться. Признак вредителя требует проверки исходного Access.',items:refs.SBR.filter(r=>filled(r.KB)&&(!filled(exclude)||!same(r.KB,exclude))).map(r=>({value:String(r.KB),label:String(r.NB||'')}))};
 }
 if(form==='ВыделВ'&&['M2PM1','M22','M23'].includes(field)&&refs.SLM){
  const prev=field==='M22'?[row.M2PM1]:field==='M23'?[row.M2PM1,row.M22]:[];
  const previousReady=field==='M2PM1'||(field==='M22'?filled(row.M2PM1)&&code(row.M2PM1)!=='0':filled(row.M22)&&code(row.M22)!=='0');
  const items=refs.SLM.filter(r=>filled(r.KM)&&(same(r.KM,0)||(
    previousReady && !prev.some(v=>same(v,r.KM)) && (
      field==='M2PM1'?[0,1,2].includes(num(r.PM2R)):[0,2].includes(num(r.PM2R))
    )
  ))).map(r=>({value:String(r.KM),label:String(r.NMR||'')}));
  return {status:'complete',reason:'Последовательность мероприятий по SLM.PM2R',items};
 }
 if(form==='ВыделВ'&&/^PRP[123]$/.test(field)&&refs.SDP_Tip){
  const i=Number(field.slice(-1));
  const already=i===1?[]:i===2?[row.PRP1]:[row.PRP1,row.PRP2];
  const ready=i===1||(filled(row['PRP'+(i-1)])&&code(row['PRP'+(i-1)])!=='0');
  const rows=distinctOptions(refs.SDP_Tip,'KPC',r=>num(r.DKP2)!==null&&num(r.DKP2)<700000,already);
  return {status:'complete',reason:'Породы подроста без повторений (SDP_Tip.DKP2)',items:ready?rows.map(r=>({value:String(r.KPC),label:String(r.NDP||'')})):[]};
 }
 if(form==='ВыделВ'&&/^PLP[123]$/.test(field)&&refs.SDP){
  const i=Number(field.slice(-1));
  const already=i===1?[]:i===2?[row.PLP1]:[row.PLP1,row.PLP2];
  const ready=i===1||(filled(row['PLP'+(i-1)])&&code(row['PLP'+(i-1)])!=='0');
  const rows=distinctOptions(refs.SDP,'KPC',r=>num(r.DKP2)!==null&&(num(r.DKP2)>700000||num(r.DKP2)===0),already);
  return {status:'complete',reason:'Породы подлеска без повторений (SDP.DKP2)',items:ready?rows.map(r=>({value:String(r.KPC),label:String(r.NDP||'')})):[]};
 }
 if(form==='Макет23'&&/^K[1-8]$/.test(field)&&refs.SOV){
  const i=Number(field.slice(1)),previous=Array.from({length:i-1},(_,j)=>row['K'+(j+1)]);
  const ready=i===1||(filled(previous.at(-1))&&code(previous.at(-1))!=='0');
  const rows=refs.SOV.filter(r=>filled(r.KOV)&&(i===1?num(r.KOV)!==135&&[0,1].includes(num(r.Priz)):num(r.Priz)===0))
    .filter(r=>!previous.some(v=>same(v,r.KOV)));
  // Access K8 contains a malformed literal "And"; do not claim exact VBA parity.
  return {status:i===8?'partial':'complete',reason:'Последовательные уникальные особенности SOV',items:ready?rows.map(r=>({value:String(r.KOV),label:String(r.NOV||'')})):[]};
 }
 return null;
}
function currentIsAllowed(value,result){
 if(!result||result.status==='waiting'||result.status==='unavailable')return null;
 if(!filled(value))return null;
 if(code(value)==='0' && !result.items.some(r=>same(r.value,0)))return null;
 return result.items.some(r=>same(r.value,value));
}
window.SolinDependentRules={forestTypes,options,currentIsAllowed,region,speciesGroup,suggestedOrigin};
})();
