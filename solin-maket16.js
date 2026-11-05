/* Read-only previews of the saved Макет16Созд / Макет16Пересчет actions.
 * No execution of Access macros or unattended changes to stored records.
 * The source recalc updates five parameters, never Ur16/Neds/Sbor.
 */
(()=>{'use strict';
const keys=['POS','LESN','KV','KGLF','VD'];
const defined=x=>x!==null&&x!==undefined&&String(x).trim()!=='';
const number=x=>defined(x)&&Number.isFinite(Number(x))?Number(x):null;
const code=x=>String(x??'').trim().toLocaleUpperCase('ru-RU');
const same=(a,b)=>defined(a)&&defined(b)&&code(a)===code(b);
const childMatches=(card,row)=>keys.every(k=>!defined(row[k])||same(row[k],card[k]));
const single=x=>number(x)===null?null:Math.fround(number(x));
const state=(status,reason,extra={})=>({status,reason,nativeAccessExecuted:false,...extra});
function context(card,org){
 if(keys.some(k=>!defined(card?.[k])))return state('waiting','Для расчёта нужен полный адрес выдела');
 if(org&&['POS','LESN'].some(k=>defined(org[k])&&!same(org[k],card[k])))return state('ambiguous','Выдел не соответствует выбранному лесничеству');
 return null;
}
function roundEven(x){
 const lo=Math.floor(x),f=x-lo;return f===.5?(lo%2===0?lo:lo+1):Math.round(x);
}
function sourceRows(card,refs,org){
 const problem=context(card,org);if(problem)return problem;
 for(const t of ['STL','S16KOEF','S16VOZ','S16POL'])if(!Array.isArray(refs?.[t]))return state('unavailable','Нет исходного справочника '+t);
 if(number(card.KU)===null)return state('waiting','Сначала укажите категорию угодий');
 if(number(card.KU)>=10)return state('not-applicable','Создание Макета 16 по исходному запросу относится к KU < 10',{rows:[]});
 if(!defined(card.M3TLU)||number(card.KlxrVD)===null)return state('waiting','Нужны тип леса и лесохозяйственная зона');
 const trees=(card._children?.Макет10||[]).map((row,index)=>({row,index})).filter(x=>childMatches(card,x.row));
 const stems=trees.filter(x=>number(x.row.IAR)===1&&same(x.row.POR,'К')&&number(x.row.KOEF)>0&&single(x.row.LET)>80);
 const fullness=trees.filter(x=>number(x.row.IAR)===1&&single(x.row.POL)>0);
 const types=refs.STL.filter(r=>same(r.KTL,card.M3TLU)&&number(r.Lxz)===number(card.KlxrVD));
 const rows=[],groups=[];
 for(const stem of stems){
  const before=rows.length,age=single(stem.row.LET);
  const ages=refs.S16VOZ.filter(r=>number(r.NVoz)!==null&&number(r.NVoz)>=age-40&&number(r.NVoz)<=age);
  const coefficients=refs.S16KOEF.filter(r=>number(r.KKoef)===number(stem.row.KOEF));
  for(const density of fullness){const pol=single(density.row.POL);
   const densities=refs.S16POL.filter(r=>number(r.KPOL)!==null&&number(r.KPOL)>=pol-.001&&number(r.KPOL)<=pol+.001);
   for(const t of types)for(const c of coefficients)for(const a of ages)for(const p of densities){
    const values=[t.UR,c.KKUR,a.UrYOZ,p.UrPOL].map(number);
    const average=values.some(x=>x===null)?null:values.reduce((sum,v)=>sum+v,0)/4;
    rows.push({...Object.fromEntries(keys.map(k=>[k,card[k]])),Koef16:number(stem.row.KOEF),Por16:stem.row.POR,
     Voz16:age,Ediz:pol,H16:card.M3TLU,Neds:1,Sbor:1,Ur16:average===null?null:roundEven(average)});
   }
  }
  groups.push({stemIndex:stem.index,outputRows:rows.length-before});
 }
 const ambiguous=groups.some(g=>g.outputRows>1);
 const incomplete=rows.some(r=>r.Ur16===null);
 return state(ambiguous?'ambiguous':incomplete?'unverified':rows.length?'complete':'empty',
  ambiguous?'Исходные JOIN создают несколько строк для одной породы: автоматический выбор запрещён':
   incomplete?'Урожайность не определена: в исходной строке есть пустое нормативное значение':
   rows.length?'Расчёт по сохранённому запросу Макет16Созд':'Исходные условия Макет16Созд не создают записей',
  {rows,groups,source:'Макет16Созд',verification:'saved-query-compatibility; not native Access execution'});
}
function creationPreview(card,refs,org){
 const result=sourceRows(card,refs,org);
 if(result.status==='complete'&&(card?._children?.Макет16||[]).length)
  return {...result,status:'conflict',reason:'Макет 16 уже содержит записи. Они сохранены; повторное создание не выполнено'};
 return result;
}
function parameterPreview(card,refs,org){
 const problem=context(card,org);if(problem)return problem;
 const trees=(card._children?.Макет10||[]).filter(r=>childMatches(card,r));
 const density=trees.filter(r=>number(r.IAR)===1&&single(r.POL)>0),updates=[],unresolved=[];
 for(const [index,row]of (card._children?.Макет16||[]).entries()){
  if(!childMatches(card,row)){unresolved.push({index,reason:'Адрес строки Макета 16 не совпадает с выделом'});continue;}
  const candidates=trees.filter(r=>same(r.POR,row.Por16)).flatMap(t=>density.map(d=>({
   Por16:t.POR,Koef16:number(t.KOEF),Voz16:single(t.LET),Ediz:single(d.POL),H16:card.M3TLU??null
  })));
  const groups=[...new Map(candidates.map(v=>[JSON.stringify(v),v])).values()];
  if(groups.length!==1){unresolved.push({index,reason:groups.length?'Несколько различных результатов исходного UPDATE':'Нет однозначной исходной строки древостоя'});continue;}
  const changes=Object.entries(groups[0]).filter(([k,v])=>row[k]!==v);
  if(changes.length)updates.push({index,values:groups[0],changes:changes.map(([field,value])=>({field,previous:row[field]??null,value})),yieldPreserved:row.Ur16??null});
 }
 return state(unresolved.length?'ambiguous':updates.length?'complete':'unchanged',
  unresolved.length?'Не все строки можно однозначно обновить':updates.length?
   'Обновляются пять параметров. Урожайность Ur16 этим запросом не пересчитывается':'Параметры уже соответствуют исходным значениям',
  {updates,unresolved,source:'Макет16Пересчет',ur16Recalculated:false});
}
window.SolinMaket16={sourceRows,creationPreview,parameterPreview,childMatches};
})();
