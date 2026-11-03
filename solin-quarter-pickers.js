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
 // All verified/observed codes are available irrespective of category or area.
 // Administrative full Кл_Рай is not in the archived public reference package.
 // Independent verified 2026 KATO district names. The full original Кл_Рай
 // table is not available; expand only with source-confirmed administrative codes.
 const KNOWN_DISTRICTS=[
  {value:'153200000',label:'Алгинский район'},
  {value:'153400000',label:'Айтекебийский район'},
  {value:'153600000',label:'Байганинский район'},
  {value:'154000000',label:'Каргалинский район'},
  {value:'154200000',label:'Хобдинский район'},
  {value:'154600000',label:'Мартукский район'},
  {value:'154800000',label:'Мугалжарский район'},
  {value:'155200000',label:'Уилский район'},
  {value:'155600000',label:'Темирский район'},
  {value:'156000000',label:'Хромтауский район'},
  {value:'156400000',label:'Шалкарский район'},
  {value:'156800000',label:'Иргизский район'},
  {value:'356400000',label:'Шетский район'}
 ];
 let persistedForests=[],listing=null;
 async function loadSavedDirectory(){
  if(listing)return listing;
  listing=(async()=>{
   try{
    await window.SolinWorkspace?.ready;
    persistedForests=await window.SolinWorkspace?.list?.()||[];
    window.dispatchEvent?.(new Event('solin-quarter-directory-ready'));
   }catch(_){persistedForests=[];}
  })();
  return listing;
 }
 const knownRows=()=>{
  const rows=[];
  const append=quarters=>{
   for(const [kv,q] of Object.entries(quarters||{}))
    for(const r of originalQuarterRows(q))rows.push({...r,KV:r.KV??kv});
  };
  if(typeof D!=='undefined')append(D?.quarters);
  for(const forest of persistedForests)append(forest.quarters);
  return rows;
 };
 function candidates(field,row,org){
  const results=new Map(),mine=new Set(),all=knownRows(),current=recordPairs(org);
  const add=(value,label)=>{
   const k=clean(value);if(!numeric(k))return;
   if(!results.has(k))results.set(k,{value:k,label:clean(label)});
   else if(label&&!results.get(k).label)results.get(k).label=clean(label);
  };
  if(field==='Raion'){
   for(const item of KNOWN_DISTRICTS)add(item.value,item.label);
   for(const r of all)if(numeric(r.Raion)&&Number(r.Raion)>0)
    add(r.Raion,'Название района не установлено');
   for(const r of current)if(numeric(r.Raion)&&Number(r.Raion)>0)mine.add(clean(r.Raion));
   return {items:[...results.values()].sort((a,b)=>Number(a.value)-Number(b.value)),
    auto:null,reason:'Подтверждённые названия районов КАТО Актюбинской области и Шетского района, а также коды сохранённых кварталов. Полная Кл_Рай отсутствует — неизвестный код можно ввести вручную. Выбор не зависит от КГЛФ.'};
  }
  if(field==='Fzona'){
   add('0','Без функциональной зоны · значение из исходной обложки');
   const table=window.SOLIN_REFS?.tables?.SFZ||[];
   for(const r of table)if(numeric(r.KFZ))
    add(r.KFZ,String(r.NFZK||r.NFZ||'Из справочника SFZ'));
   for(const r of all)if(numeric(r.Fzona))
    add(r.Fzona,'Из сохранённой обложки квартала');
   return {items:[...results.values()].sort((a,b)=>Number(a.value)-Number(b.value)),
    auto:null,reason:'Полный доступный список кодов из SFZ и сохранённых кварталов без фильтра по КГЛФ. Нормативный SQL Access восстановлен не полностью — значение при необходимости сверяйте по оригиналу.'};
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
   // Region choice is human-readable; the stored KATO value is shown separately.
   // A verified district name must never be confused with its MDB numeric code.
   let codeBox=null,codeOutput=null;
   if(field==='Raion'){
     codeBox=document.createElement('div');codeBox.className='quarter-code-display';
     const title=document.createElement('span');title.textContent='Код административного района';
     codeOutput=document.createElement('input');codeOutput.type='text';codeOutput.readOnly=true;
     codeOutput.tabIndex=-1;codeOutput.className='quarter-code-readonly';
     codeOutput.setAttribute('aria-label','Код выбранного административного района');
     codeOutput.placeholder='Не указан';
     codeBox.append(title,codeOutput);
   }
   input.replaceWith(select);
   select.insertAdjacentElement('afterend',manual);
   if(codeBox)manual.insertAdjacentElement('afterend',codeBox);
   let hint=options.hint||null, lastItems=[];
   const value=()=>select.value===MANUAL?manual.value.trim():select.value;
   const updateCode=()=>{if(codeOutput)codeOutput.value=value();};
   const sync=(opts={})=>{
     const row=typeof context==='function'?context():context;
     const org=options.org?.()||((typeof D!=='undefined'&&D?.lesnichestvo?.[0])||{});
     const data=candidates(field,row||{},org);
     const previous=opts.clear?'':(opts.value!==undefined?clean(opts.value):value());
     const seen=new Set(),items=[];
     for(const item of data.items){if(seen.has(item.value))continue;seen.add(item.value);items.push(item);}
     const entries=[new Option('— Не указано —','')];
     for(const item of items)entries.push(new Option(field==='Raion'?(item.label||'Название района не установлено'):item.value+(item.label?' — '+item.label:''),item.value));
     entries.push(new Option('✎ Ввести код вручную',MANUAL));
     select.replaceChildren(...entries);
     lastItems=items;
     if(previous&&seen.has(previous)){select.value=previous;manual.value='';}
     else if(previous){select.value=MANUAL;manual.value=previous;}
     else if(!opts.disableAuto&&data.auto&&seen.has(data.auto)){select.value=data.auto;manual.value='';}
     else if(items.length){select.value='';manual.value='';}
     else{select.value=MANUAL;manual.value='';}
     select.disabled=false;manual.disabled=false;
     manual.hidden=select.value!==MANUAL;
     if(hint)hint.textContent=data.reason;
     updateCode();
     return data;
   };
   select.addEventListener('change',()=>{
     manual.hidden=select.disabled||select.value!==MANUAL;
     if(select.value===MANUAL&&!select.disabled)manual.focus();
     else manual.value='';
     updateCode();
   });
   // Forward free-text edits to existing card form listeners. The select is
   // the canonical control, its value() resolves the manual code.
   const forward=type=>{
    if(typeof Event==='function'&&typeof select.dispatchEvent==='function')
     select.dispatchEvent(new Event(type,{bubbles:true}));
   };
   manual.addEventListener('input',()=>{updateCode();forward('input');});
   manual.addEventListener('change',()=>{updateCode();forward('change');});
   const picker={select,manual,sync,value,codeOutput,codeBox,get items(){return lastItems;}};
   select.__solinQuarterPicker=picker;
   sync({value:options.current??input.value??''});
   // If user opens the quarter before the offline reference bundle is ready,
   // enrich the same mounted iOS select when the real SFZ rows arrive.
   window.addEventListener?.('solin-refs-ready',()=>sync({value:value()}),{once:true});
   window.addEventListener?.('solin-quarter-directory-ready',()=>sync({value:value()}),{once:true});
   void loadSavedDirectory();
   return picker;
 }
 function value(el){return el?.__solinQuarterPicker?.value()??el?.value??'';}
 window.SolinQuarterPickers={mount,value,candidates};
})();