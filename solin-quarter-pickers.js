/* Native quarter comboboxes: source-backed suggestions + explicit manual fallback.
 * The original Кл_Рай / full ТЕОб predicate is missing; never fabricate a
 * nationwide district list or claim the partial SFZ condition is exhaustive. */
(() => {'use strict';
 const MANUAL='__solin_manual__';
 const clean=v=>String(v??'').trim();
 const same=(a,b)=>clean(a)===clean(b);
 const numeric=v=>/^\d+$/.test(clean(v));
 const originalQuarterRows=q=>q?.quarterRows?.length?q.quarterRows:q?.meta?[q.meta]:[];
 const recordPairs=org=>{
   const rows=[];
   if(typeof D==='undefined'||!D?.quarters)return rows;
   for(const [kv,q] of Object.entries(D.quarters)){
     for(const row of originalQuarterRows(q)){
       if(!same(row.POS??org?.POS,org?.POS)||!same(row.LESN??org?.LESN,org?.LESN))continue;
       rows.push({...row,KV:row.KV??kv});
     }
   }
   return rows;
 };
 const fromScreenshot=org=>same(org?.POS,723)&&same(org?.LESN,4);
 function candidates(field,row,org){
   const source=window.SolinDependentRules?.options('Квартал',field,row,null,org);
   const results=new Map(),sameForest=recordPairs(org),confirmed=new Set();
   const add=(value,label,verified=false)=>{
     const key=clean(value);if(!numeric(key))return;
     if(!results.has(key))results.set(key,{value:key,label:clean(label)});
     if(verified)confirmed.add(key);
   };
   if(field==='Raion'){
     for(const item of source?.items||[])add(item.value,item.label);
     const saved=new Set();
     for(const r of sameForest)if(numeric(r.Raion)){const v=clean(r.Raion);saved.add(v);add(v,'Из ранее сохранённого квартала '+r.KV,true);}
     if(fromScreenshot(org)){add('356400000','Шетский район · проверено по исходному SOLI-N',true);saved.add('356400000');}
     const only=saved.size===1?[...saved][0]:null;
     return {items:[...results.values()],auto:only,reason:results.size?
       'Коды из кварталов этого лесничества / сверенного образца. Исходный полный справочник «Кл_Рай» отсутствует: при необходимости выберите другой проверенный код вручную.':
       'Для этого лесничества нет сохранённого списка районов. Введите код из оригинальной SOLI-N или официального КАТО вручную.'};
   }
   if(field==='Fzona'){
     for(const item of source?.items||[])add(item.value,item.label||'Кандидат из SFZ');
     const saved=new Set();
     for(const r of sameForest)if(numeric(r.Fzona)&&same(r.KGLF,row?.KGLF)){
       const v=clean(r.Fzona);saved.add(v);add(v,'Из квартала '+r.KV+' этой категории ГЛФ',true);
     }
     if(fromScreenshot(org)&&same(row?.KGLF,27)){
       add('0','Без функциональной зоны · исходный пример',true);saved.add('0');
     }
     return {items:[...results.values()],auto:saved.size===1?[...saved][0]:null,
       reason:(source?.reason||'Справочник SFZ недоступен')+
       '. В списке — варианты по категории ГЛФ и коды из сохранённых кварталов. Неподтверждённые значения проверьте по оригиналу.'};
   }
   return {items:[],auto:null,reason:'Нет доступного справочника'};
 }
 function mount(input,field,context,options={}){
   if(!input||!['Fzona','Raion'].includes(field))return null;
   if(input.__solinQuarterPicker)return input.__solinQuarterPicker;
   const select=document.createElement('select');
   for(const attr of input.attributes)
     if(!['type','inputmode','list','value','placeholder','autocomplete'].includes(attr.name))
       select.setAttribute(attr.name,attr.value);
   select.dataset.quarterPicker=field;
   const manual=document.createElement('input');
   manual.type='text';manual.inputMode='numeric';manual.autocomplete='off';
   manual.className='quarter-code-manual';manual.placeholder=field==='Raion'?'Код района (например, 356400000)':'Код функциональной зоны';
   manual.setAttribute('aria-label',field==='Raion'?'Ввести код административного района':'Ввести код функциональной зоны');
   manual.hidden=true;
   input.replaceWith(select);
   select.insertAdjacentElement('afterend',manual);
   let hint=options.hint||null, lastItems=[];
   const value=()=>select.value===MANUAL?manual.value.trim():select.value;
   const sync=(opts={})=>{
     const row=typeof context==='function'?context():context;
     const org=options.org?.()||((typeof D!=='undefined'&&D?.lesnichestvo?.[0])||{});
     const data=candidates(field,row||{},org);
     const previous=opts.clear?'':(opts.value!==undefined?clean(opts.value):value());
     const seen=new Set(),items=[];
     for(const item of data.items){if(seen.has(item.value))continue;seen.add(item.value);items.push(item);}
     const entries=[new Option('— Не указано —','')];
     for(const item of items)entries.push(new Option(item.value+(item.label?' — '+item.label:''),item.value));
     entries.push(new Option('✎ Ввести код вручную',MANUAL));
     select.replaceChildren(...entries);
     lastItems=items;
     if(previous&&seen.has(previous)){select.value=previous;manual.value='';}
     else if(previous){select.value=MANUAL;manual.value=previous;}
     else if(!opts.disableAuto&&data.auto&&seen.has(data.auto)){select.value=data.auto;manual.value='';}
     else if(items.length){select.value='';manual.value='';}
     else{select.value=MANUAL;manual.value='';}
     const waiting=field==='Fzona'&&!clean(row?.KGLF);
     select.disabled=waiting;manual.disabled=waiting;
     if(waiting){select.value='';manual.value='';}
     manual.hidden=waiting||select.value!==MANUAL;
     if(hint)hint.textContent=data.reason;
     return data;
   };
   select.addEventListener('change',()=>{
     manual.hidden=select.disabled||select.value!==MANUAL;
     if(select.value===MANUAL&&!select.disabled)manual.focus();
     else manual.value='';
   });
   const picker={select,manual,sync,value,get items(){return lastItems;}};
   select.__solinQuarterPicker=picker;
   sync({value:options.current??input.value??''});
   return picker;
 }
 function value(el){return el?.__solinQuarterPicker?.value()??el?.value??'';}
 window.SolinQuarterPickers={mount,value,candidates};
})();