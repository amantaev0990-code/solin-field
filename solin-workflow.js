/* SOLI-N Field — audited workflow layer, 2026-10-23.
 * Reproduces confirmed menu -> quarter -> stand -> makets structure.
 * Does NOT execute original Access/VBA/SQL or pretend its full calculations are ported.
 * Existing proven CMF2 structural-v4 / inline-v7 map decoders remain untouched.
 */
(function(){
'use strict';
const WORK_KEY='solin_field_audited_work_v1';
const KEY_FIELDS=['POS','LESN','KV','KGLF','VD'];
const CORE=['Макет10','Макет11','Макет12','Макет13','Макет14','Макет15','Макет16','Макет17','Макет19','Макет20','Макет21','Макет23','Макет25','Макет27','Макет28'];
const NAMES={Макет10:'Таксационная характеристика · древостой',Макет11:'Лесные культуры',Макет12:'Повреждение насаждений',Макет13:'Земли линейного протяжения',Макет14:'Травяные растения, ягодники',Макет15:'Выполненные хозяйственные мероприятия',Макет16:'Недревесное сырьё',Макет17:'Сельскохозяйственные угодья',Макет19:'Болото',Макет20:'Потери древесины',Макет21:'Ландшафтная характеристика',Макет23:'Особенности выдела',Макет25:'Плантация, древесная школа',Макет27:'Прежнее угодье',Макет28:'Доступность для транспорта'};
const LABELS={
IAR:'Ярус',KOEF:'Коэффициент состава',POR:'Порода',LET:'Возраст, лет',PH:'Средняя высота, м',PD2:'Диаметр, см',KT:'Класс товарности',PROI:'Происхождение',POL:'Полнота',SPS:'Сумма площадей сечений',ZAP:'Запас, м³/га',
GC:'Год создания',COP:'Способ обработки почвы',CCZ:'Схема смешения',RMR:'Мероприятие',RVR:'Вид работ',KOL:'Количество',CLK:'Класс культуры',PG:'Показатель',
KTP:'Тип повреждения',GP:'Год повреждения',PORP:'Повреждённая порода',VV:'Вид вредителя',SV:'Степень вреда',VB:'Вид болезни',SB:'Степень болезни',
SHT:'Ширина',PRT:'Протяжённость',SOST:'Состояние',NAZ:'Назначение',TP:'Тип',SHR:'Ширина, м',SEZ:'Сезон',TM:'Характеристика',
KU:'Категория угодий',VTR1:'Вид сырья 1',PTR1:'Площадь сырья 1, га',VTR2:'Урожайность надземной части 1, кг/га',PTR2:'Урожайность подземной части 1, кг/га',VTR3:'Вид сырья 2',PTR3:'Площадь сырья 2, га',VTR4:'Урожайность надземной части 2, кг/га',PTR4:'Урожайность подземной части 2, кг/га',
KMP:'Выполненное мероприятие',G15:'Год выполнения',P15:'Порода',VZ:'Вырубленный запас',AV:'Анализ выполнения',OC:'Оценка',PNV:'Причина неудовлетворительного выполнения',PL15:'Повреждённая площадь',
Por16:'Порода',Koef16:'Коэффициент',Voz16:'Возраст',H16:'Высота',Neds:'Недревесный ресурс',Ediz:'Единица измерения',Ur16:'Урожайность',Sbor:'Сбор',
PL:'Пользователь угодья',TSP:'Тип сенокоса или пастбища',CSP:'Состояние угодья',P17:'Порода зарастания',PR:'Зарастание, %',UR:'Урожайность, т/га',
TB:'Тип болота',TR:'Тип растительности',MTC:'Мощность торфа',ZP:'Зарастание: порода',ZPR:'Зарастание, %',
KP:'Категория потерь',MBD:'Вид древесины',P20:'Порода',ZO:'Объём',LIK:'Ликвидная древесина',DEL:'Деловая древесина',PLP:'Площадь',
TL:'Тип ландшафта',OES:'Эстетическая оценка',ORE:'Рекреационная оценка',UST:'Устойчивость',STP:'Проходимость',SPR:'Просматриваемость',SD:'Стадия дигрессии',MAF:'Служебное поле (источник требует проверки)',
K1:'Особенность 1',K2:'Особенность 2',K3:'Особенность 3',K4:'Особенность 4',K5:'Особенность 5',K6:'Особенность 6',K7:'Особенность 7',K8:'Особенность 8',
GZ:'Год закладки',KLD:'Количество',KU_St:'Прежняя категория угодий',PD:'Доступность для транспорта',TTR:'Тип транспорта',RAS:'Расстояние до дороги, км'
};
const FORM_LABELS={KU:'Категория угодий',PLV:'Площадь, га',KlxrVD:'Хозяйственная секция',M3Pr:'Главная порода',M3B:'Класс бонитета',M3TL:'Тип леса',M3TLU:'Тип лесорастительных условий',M2PM1:'Проектируемое мероприятие',M2Pr:'Интенсивность, %',Fzona:'Функциональная зона',OZU:'Особо защитный участок',CkKr:'Крутизна склона',CkEk:'Экспозиция склона',VNUM:'Высота над уровнем моря',M4ZO:'Общая захламлённость',M4ZL:'Ликвидная захламлённость',M4SS:'Сухостой'};
const EDIT_FIELDS=["KlxrVD","Fzona","PLV","KU","PP","CR","ARE","OZU","CkEk","CkKr","VNUM","ErV","ErCt","M2PM1","M2Pr","PTK1","M22","PTK2","M23","PTK3","M2Cp","M3Pr","M3B","M3TL","M3TLU","M3G","M3KP","M3KPC","M3D","M3TR","M4ZO","M4ZL","M4SS","M4TX","NE2A","AKL","AGR","AGR1","STUR","STUR1","Vsost","PRkol","PRH","PRA","PRK1","PRP1","PRK2","PRP2","PRK3","PRP3","PROC","PLG","PLP1","PLP2","PLP3"];
const DECIMAL=new Set(['RAS','Koef16','Voz16','H16','Ur16','Sbor','VZ','SHR','PRT','SHT','KLD','PLV','PH','PD2','POL','SPS','ZAP','PR','M2Pr','SHR','PL','PL15','PTR1','PTR2','PTR3','PTR4','ZPR','PRH','STUR1','KOL','KOEF','AV','ZO','LIK','DEL','PLP']);
const MULTIPLE=new Set(['Макет10','Макет11','Макет12','Макет13','Макет15','Макет16','Макет20','Макет25']);
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const record=()=>typeof current!=='undefined'?current:null;
const db=()=>typeof D!=='undefined'?D:null;
const rowKey=r=>[r.POS??db()?.lesnichestvo?.[0]?.POS??'',r.LESN??db()?.lesnichestvo?.[0]?.LESN??'',r.KV,r.KGLF??'',r.VD].join('::');
const read=()=>{try{return JSON.parse(localStorage.getItem(WORK_KEY)||'{}')}catch(_){return {}}};
const store=(r,patch)=>{const data=read(),key=rowKey(r);data[key]={...data[key],...patch,updatedAt:new Date().toISOString()};const previous=localStorage.getItem(WORK_KEY);try{localStorage.setItem(WORK_KEY,JSON.stringify(data));window.solinCore?.checkpoint('Сохранение '+key)}catch(e){if(previous===null)localStorage.removeItem(WORK_KEY);else localStorage.setItem(WORK_KEY,previous);throw e;}};
const notify=m=>(typeof toast==='function'?toast(m):alert(m));
const fmt=v=>v==null||v===''?'—':String(v);
function localPatch(r){
 const data=read()[rowKey(r)];if(!data)return;
 // WORK_KEY is a legacy supplementary cache, not the authoritative workspace.
 // Previously Object.assign overwrote a NEW quarter-linked KlxrVD with stale
 // values whenever renderComp reopened the stand; old makets also replaced
 // the freshly saved source. Recover *missing* fields/rows only.
 const empty=v=>v===undefined||v===null||String(v)==='';
 for(const [key,value] of Object.entries(data.base||{}))
  if(empty(r[key])&&!empty(value))r[key]=value;
 r._children=r._children||{};
 for(const [m,rows] of Object.entries(data.makets||{}))
  if(!r._children[m]?.length&&Array.isArray(rows)&&rows.length)
   r._children[m]=rows.map(v=>({...v}));
}
function apply(){const database=db();if(!database?.quarters)return;for(const q of Object.values(database.quarters))for(const r of q.compartments||[])localPatch(r);}
let currentMaket='Макет10',activeMakEdit=null;
function findLookups(field,form){
 const exact=window.SolinHuman?.lookup(form,field);if(exact)return exact;
 if(form&&db()?.scopedLookups?.[form]?.[field])return db().scopedLookups[form][field];
 const database=db();let mapping={POR:'POR',P15:'POR',PORP:'POR',M3Pr:'POR',PRP1:'POR',KU:'KU',KU_St:'KU',TB:'TB',TR:'TR',IAR:'IAR',M3B:'M3B',M2PM1:'M2PM1'}[field];
 return mapping?database?.fieldLookups?.[mapping]:null;
}
function fieldInput(name,value='',prefix='wf',form='ВыделВ',context=record()){
 const policy=window.SolinCategoryRules?.field(context?.KU,form,name,window.SOLIN_REFS?.tables);
 if(form==='Макет10'&&name==='POL'&&policy&&policy.kind!=='fullness'){
  const survival=policy.kind==='survival',raw=String(value??'');
  return '<label class="wf-field"><span>'+h(policy.label)+'</span><input type="number" id="'+h(prefix+'_'+name)+
   '" data-wffield="POL" data-solin-form="Макет10" data-solin-initial="'+h(raw)+'" value="'+h(raw)+
   '" inputmode="'+(survival?'numeric':'decimal')+'" step="'+(survival?'1':'any')+'"'+
   (survival?' min="1" max="100"':'')+'></label>';
 }
 if(window.SolinHuman?.input)return SolinHuman.input(name,value,prefix,form);
 const label=window.SolinHuman?.label(form,name)||LABELS[name]||FORM_LABELS[name]||db()?.fieldLabels?.[name]||name;
 const id=prefix+'_'+name,lookup=findLookups(name,form),str=String(value??'');
 if(lookup){
 const options=Object.entries(lookup).filter(([k,v])=>k!==''&&v!=null).map(([k,v])=>'<option value="'+h(k)+'"'+(String(k)===str?' selected':'')+'>'+h(String(k)+' — '+String(v))+'</option>').join('');
 return '<label class="wf-field"><span>'+h(label)+' <small>'+h('')+'</small></span><select id="'+h(id)+'" data-wffield="'+h(name)+'"><option value="">— не указано —</option>'+options+'</select></label>';
 }
 const numeric=DECIMAL.has(name)||['IAR','LET','VNUM','PRA','PRkol','KOEF','PH','PD2','ZAP','POL','MTC','G15','GZ'].includes(name);
 return '<label class="wf-field"><span>'+h(label)+' <small>'+h('')+'</small></span><input id="'+h(id)+'" data-wffield="'+h(name)+'" '+(numeric?'inputmode="decimal"':'')+' autocomplete="off" value="'+h(str)+'" placeholder="—"></label>';
}
function humanInputs(fields,values,prefix,form,context=record()){const isTech=f=>window.SolinHuman?.isTechnical(form,f);fields=fields.filter(f=>!(form==='Макет10'&&f==='SPS'));const main=fields.filter(f=>!isTech(f)).map(f=>fieldInput(f,values[f]??'',prefix,form,context)).join('');const technical=fields.filter(isTech).map(f=>fieldInput(f,values[f]??'',prefix,form,context)).join('');return main+(technical?'<details class="human-technical"><summary>Служебные поля · значения сохранены</summary><div class="formGrid">'+technical+'</div></details>':'');}
function bindInputs(root,schema,prefix,values){const obj={};for(const key of schema){const el=root.querySelector('#'+prefix+'_'+key);if(!el)continue;const typed=window.SolinFieldTypes?.read(el,values?.[key],el.dataset.solinForm||'ВыделВ',key);if(typed!==undefined){obj[key]=typed;continue;}const raw=el.value.trim();if(raw===''){obj[key]=null;continue;}
if((DECIMAL.has(key)||['IAR','LET','VNUM','PRA','PRkol','MTC','G15','GZ','PH','PD2','ZAP','POL'].includes(key))&&!Number.isFinite(Number(raw.replace(',','.'))))throw Error('Проверь число: '+(LABELS[key]||key));
obj[key]=DECIMAL.has(key)||['IAR','LET','VNUM','PRA','PRkol','MTC','G15','GZ','PH','PD2','ZAP','POL'].includes(key)?Number(raw.replace(',','.')):raw;
}return obj;}
function maketsOf(r){return r?Object.keys(r._children||{}):[];}
function rowsOf(r,m){
 const rows=r?._children?.[m];
 if(!Array.isArray(rows))return [];
 return m==='Макет10'&&window.SolinDependentRules?.orderMaket10Rows?
  window.SolinDependentRules.orderMaket10Rows(rows):rows;
}
function maketSummary(r,m){const rows=rowsOf(r,m),length=rows.length;
 if(m==='Макет10'&&length){const summed=rows.reduce((s,v)=>s+(Number(v.ZAP)||0),0);return length+' записей · Σ ZAP '+summed.toLocaleString('ru-RU')+' (справочно)';}
 return length?length+' записей':'Нет данных';
}
function cardToolbar(){const host=document.querySelector('#childTabs');if(!host||!record())return;
const others=CORE.filter(m=>m!=='Макет10');
const tabs='<div class="v25-card-switch" role="navigation" aria-label="Разделы карточки">'+
 '<button type="button"'+(currentMaket==='Макет10'?' class="active" aria-current="true"':'')+' data-maket="Макет10">Основные данные</button>'+
 '<details class="v25-card-more"><summary>Макеты</summary><div>'+
 others.map(m=>'<button type="button" data-maket="'+h(m)+'"'+(currentMaket===m?' aria-current="true"':'')+'>'+h(m.replace('Макет','М'))+' · '+h(window.SolinHuman?.formName(m)||NAMES[m])+'</button>').join('')+
 '<button type="button" id="wfAllMakets">Все макеты</button>'+
 '<button type="button" id="wfShowComplete">Вся карточка</button></div></details></div>';
host.innerHTML=tabs;
host.querySelectorAll('[data-maket]').forEach(b=>b.onclick=()=>openMaket(b.dataset.maket));
host.querySelector('#wfAllMakets').onclick=()=>window.SolinCardEditor?.openQuick(record(),'makets');
host.querySelector('#wfShowComplete').onclick=showWholeCard;
const oldBar=document.querySelector('#humanContent .solinEditBar');
if(oldBar)oldBar.style.display='none';
const content=document.querySelector('#humanContent');
if(content&&!content.querySelector('#wfCardActions')){
 const bar=document.createElement('div');bar.id='wfCardActions';bar.className='wf-toolbar v25-card-actions';
 bar.innerHTML='<button class="wf-primary" id="wfEditBase">Редактировать карточку</button>'+
 '<button id="wfCardCheck">Контроль</button>'+
 '<details class="v25-card-actions-more"><summary>Ещё</summary><div>'+
 '<button id="wfCardRelations">Связи полей</button>'+
 '<button id="wfCardPrint">Печать КТ</button>'+
 '<button id="wfCardExit">К кварталам</button></div></details>';
 // Never validate or report on a stand that is not committed.
 if(!db()?.quarters?.[String(record().KV)]?.compartments?.includes(record())){
  for(const id of ['wfCardCheck','wfCardRelations','wfCardPrint']){
   const button=bar.querySelector('#'+id);
   if(button){button.disabled=true;button.title='Сначала сохраните новую карточку';}
  }
  host.querySelectorAll('button').forEach(control=>{control.disabled=true;control.title='Сначала сохраните новую карточку';});
 }
 content.prepend(bar);
 bar.querySelector('#wfEditBase').onclick=editBase;
 bar.querySelector('#wfCardCheck').onclick=()=>SolinControlUI.open({records:[record()],caption:'Карточка · квартал '+record().KV+' · выдел '+record().VD});
 bar.querySelector('#wfCardRelations').onclick=()=>window.SolinDependencyAudit?.open([record()],{caption:'Выдел '+record().KV+'/'+record().VD});
 bar.querySelector('#wfCardPrint').onclick=printCard;
 bar.querySelector('#wfCardExit').onclick=exitCard;
}
}
function showWholeCard(){const r=record();if(!r)return;document.querySelector('#childContent').innerHTML='<div class="wf-maket-view"><h3>Краткая карточка таксации · КТ</h3><p class="wf-muted">Аналог сводного просмотра ВыделКрат. Данные отображаются без расчёта исходных Access-отчётов.</p>'+CORE.map(m=>'<div class="wf-summary-row"><b>'+m.replace('Макет','')+' · '+h(window.SolinHuman?.formName(m)||NAMES[m])+'</b><span>'+h(maketSummary(r,m))+'</span><button data-cardmak="'+m+'">Открыть →</button></div>').join('')+'</div>';
document.querySelectorAll('[data-cardmak]').forEach(b=>b.onclick=()=>openMaket(b.dataset.cardmak));}
function openMaket(m){const r=record();if(!r||!CORE.includes(m))return;currentMaket=m;cardToolbar();
const rs=rowsOf(r,m),fields=(db()?.transfSchema?.[m]||[]).filter(n=>!KEY_FIELDS.includes(n)&&!(m==='Макет10'&&n==='SPS'));
const wrap=document.querySelector('#childContent');if(!wrap)return;
let html='<div class="wf-maket-view"><div class="wf-section-head"><div><div class="wf-eyebrow">'+rs.length+' записей</div><h3>'+h(m==='Макет10'?'Основные данные':window.SolinHuman?.formName(m)||NAMES[m])+'</h3></div><button class="wf-primary" id="wfAddRow">＋ Строка</button></div>';
html+='<p class="wf-muted">Выберите запись для изменения или добавьте новую.</p>';
if(m==='Макет10'&&window.SolinCardCalculations){
 const b=window.SolinCardCalculations.bonitet(r,window.SOLIN_REFS?.tables);
 html+='<div class="wf-bonitet-status" data-wf-bonitet-status="'+h(b.status)+'"><strong>'+
  (b.status==='complete'?'Бонитет по К58: класс '+h(b.expected):'Бонитет не рассчитан по К58')+
  '</strong><p>'+h(b.reason||'Проверяются исходные данные')+
  (b.status==='complete'&&String(r.M3B??'0')!==String(b.expected)?
    '. Для сохранения расчётного класса откройте строку Макета 10 и нажмите «Сохранить».':'')+
  '</p></div>';
}
if(!rs.length)html+='<div class="wf-empty">Здесь пока нет записей. Добавьте первую.</div>';
rs.forEach((row,i)=>{
 const renderValue=k=>row[k]!==null&&row[k]!==undefined&&row[k]!==''?'<div class="wf-kv"><span>'+h(window.SolinHuman?.label(m,k)||LABELS[k]||FORM_LABELS[k]||k)+'</span><b>'+h(window.SolinHuman?SolinHuman.value(m,k,row[k],row):findLookups(k,m)?.[String(row[k])]||fmt(row[k]))+'</b></div>':'';const values=fields.filter(k=>!window.SolinHuman?.isTechnical(m,k)).map(renderValue).filter(Boolean).join('');const raw=fields.filter(k=>window.SolinHuman?.isTechnical(m,k)).map(renderValue).filter(Boolean).join('');
 html+='<article class="wf-row"><div class="wf-rowhead"><b>Запись '+(i+1)+'</b><span><button data-edit="'+i+'">Изменить</button><button class="wf-danger" data-del="'+i+'">Удалить</button></span></div><div class="wf-grid">'+(values||'<div class="wf-muted">Запись без заполненных полей</div>')+(raw?'<details class="human-source"><summary>Служебные данные</summary>'+raw+'</details>':'')+'</div></article>';
});
html+='</div>';wrap.innerHTML=html;
wrap.querySelector('#wfAddRow').onclick=()=>m==='Макет10'?editComposition({add:true}):editMaket(m,rs.length);
wrap.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editMaket(m,Number(b.dataset.edit)));
wrap.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>deleteMaket(m,Number(b.dataset.del)));
}
// V20: edit an entire mixed-species stand in one transaction. Each species is
// stored as its own original Maket10 row, never concatenated into a fake code.
function editComposition({add=false}={}){
 const r=record();if(!r)return;
 const name='Макет10';
 const fields=['IAR','KOEF','POR','LET','PH','PD2','KT','PROI','POL','ZAP'];
 const existing=rowsOf(r,name).map(x=>({...x}));
 const drafts=existing.length?existing:[{IAR:1,KOEF:10,POR:null,LET:null,PH:null,PD2:null,KT:null,PROI:null,POL:null,ZAP:0}];
 openModal('Основные данные · древостой',
  '<div class="v25-stand-basics">'+
   '<label class="wf-field"><span>Категория угодий</span><select id="wfCompKU"></select></label>'+
   '<label class="wf-field"><span>Характеристика типа леса</span><select id="wfQuickForestType"><option value="">Не указано</option></select></label>'+
  '</div>'+
  '<div class="wf-composition-actions"><button type="button" id="wfCompAdd" class="secondary">＋ Строка</button><output id="wfCompTotal" role="status" aria-live="polite"></output></div>'+
  '<details class="v25-stand-rules"><summary>Проверка связей</summary><p id="wfCompPolicy" role="status" aria-live="polite"></p><p id="wfQuickForestHint" role="status" aria-live="polite"></p></details>'+
  '<div id="wfCompRows"></div>'+
  '<details id="wfQuickMakets" class="v25-stand-makets"><summary>Макеты</summary><div class="v25-stand-makets-actions">'+
   '<select id="wfQuickDestination" aria-label="Выберите макет"><option value="">Выбрать раздел…</option>'+
    CORE.filter(m=>m!=='Макет10').map(m=>'<option value="'+h(m)+'">'+h(m.replace('Макет','М'))+' · '+h(window.SolinHuman?.formName(m)||NAMES[m])+'</option>').join('')+
    '<option value="31">М31 · Подрост</option><option value="32">М32 · Подлесок</option><option value="makets">Все макеты</option><option value="kt">КТ · Просмотр</option><option value="print">Печать КТ</option><option value="cut">Контроль рубок</option><option value="control">Контроль</option></select>'+
   '<button type="button" id="wfQuickNavigate">Сохранить и открыть</button></div></details>'+
  '<div class="formActions v25-stand-save"><button type="button" class="secondary" id="wfCompCancel">Отмена</button><button type="button" class="primary" id="wfCompSave">Сохранить</button></div>');
 const root=document.getElementById('modalBody'),host=root.querySelector('#wfCompRows'),cat=root.querySelector('#wfCompKU');
 const ref=window.SOLIN_REFS?.tables,rules=window.SolinDependentRules;
 const forestSelect=root.querySelector('#wfQuickForestType');
 const forestHint=root.querySelector('#wfQuickForestHint');
 if(r.M3TLU!==null&&r.M3TLU!==undefined&&String(r.M3TLU)!==''){
  const stored=new Option('Сохранённый тип леса: '+String(r.M3TLU),String(r.M3TLU));
  forestSelect.add(stored);forestSelect.value=String(r.M3TLU);
 }
 const categories=new Map();
 for(const entry of ref?.SKU||[]){const val=String(entry.KU??'');if(!val||categories.has(val))continue;
  const layers=rules?.allowedLayers?.({KU:entry.KU},ref);
  if(!layers?.items?.length)continue;
  categories.set(val,String(entry.NKU||''));}
 cat.replaceChildren(new Option('— Выберите категорию угодий —',''),
  ...[...categories].map(([val,label])=>new Option(val+' — '+label,val)));
 if(r.KU!=null&&!categories.has(String(r.KU)))cat.add(new Option(String(r.KU)+' — текущее значение',String(r.KU)));
 cat.value=String(r.KU??'');
 let serial=0;
 const nextId=()=>++serial;
 const cards=[];
 // Stable row order keeps all species and MDB fields intact.
 const reorderCards=()=>{
  const rank=item=>{
   const code=item.card.querySelector('#'+item.prefix+'_IAR')?.value;
   const n=code===undefined||code===null||code===''?null:Number(code);
   return Number.isInteger(n)&&n>=1&&n<=8?n:Infinity;
  };
  const ordered=cards.map((item,index)=>({item,index,rank:rank(item)}))
   .sort((a,b)=>a.rank-b.rank||a.index-b.index).map(x=>x.item);
  cards.splice(0,cards.length,...ordered);
  for(const item of cards)host.append(item.card);
  renumber();
 };
 const renderOne=(original)=>{
  const token=nextId();const prefix='wf20_'+token;
  const card=document.createElement('section');card.className='wf-composition-card';card.dataset.compToken=String(token);
  card.innerHTML='<div class="wf-rowhead"><b>Порода '+(cards.length+1)+'</b><button type="button" class="wf-danger" data-wf-remove>Удалить породу</button></div>'+
   '<div class="formGrid wf-formgrid">'+humanInputs(fields,original,prefix,name,{...r,KU:cat.value||r.KU})+'</div>';
  host.append(card);const item={token,prefix,card,original,lastSpecies:original.POR};cards.push(item);
  card.querySelector('[data-wf-remove]').onclick=()=>{if(cards.length===1)return notify('Оставьте хотя бы одну породу');
   const pos=cards.indexOf(item);if(pos>=0)cards.splice(pos,1);card.remove();renumber();refresh();};
  for(const field of fields){const el=card.querySelector('#'+prefix+'_'+field);if(!el)continue;
   el.addEventListener('input',refresh);
   el.addEventListener('change',() => {
    if(field==='POR'||field==='IAR') {
     const por=card.querySelector('#'+prefix+'_POR');
     const iar=card.querySelector('#'+prefix+'_IAR');
     const origin=card.querySelector('#'+prefix+'_PROI');
     const previous=rules?.suggestedOrigin?.(item.lastSpecies,ref);
     const suggested=rules?.suggestedOrigin?.(por?.value,ref);
     if(iar?.value==='1'&&origin&&suggested!=null&&(!origin.value||String(previous)===origin.value)){
      if(origin.tagName==='SELECT'&&![...origin.options].some(option=>option.value===String(suggested)))
       origin.add(new Option(String(suggested),String(suggested)));
      origin.value=String(suggested);
     }
     item.lastSpecies=por?.value;
    }
    if(field==='IAR')reorderCards();
    refresh();
   });
  }
  setupRowOptions(item);reorderCards();refresh();
  return item;
 };
 const renumber=()=>cards.forEach((x,i)=>{const title=x.card.querySelector('.wf-rowhead b');if(title)title.textContent='Порода '+(i+1)});
 const setupRowOptions=(item)=>{
  if(!rules)return;
  const candidate={...item.original};for(const field of fields){const el=item.card.querySelector('#'+item.prefix+'_'+field);
   if(el)candidate[field]=el.value===''?null:el.value;}
  for(const field of ['IAR','POR','PROI']){
   const el=item.card.querySelector('#'+item.prefix+'_'+field);if(!el||el.tagName!=='SELECT')continue;
   const res=rules.options(name,field,candidate,{...r,KU:cat.value||r.KU},db()?.lesnichestvo?.[0]);
   if(res)rules.applySelect(el,res,{current:candidate[field]});
  }
 };
 function readRows(){return cards.map(item=>{
  const values=bindInputs(item.card,fields,item.prefix,item.original);
  const row={...item.original,...values};
  for(const k of KEY_FIELDS)row[k]=r[k]??null;
  if(String(row.IAR)==='1'&&row.POR!=null&&row.PROI==null){const suggested=rules?.suggestedOrigin?.(row.POR,ref);if(suggested!=null)row.PROI=suggested;}
  return row;
 });}
 function refresh(){
  const totals=new Map(),states=[];
  for(const [index,item] of cards.entries()){
   const el=item.card.querySelector('#'+item.prefix+'_KOEF'),layer=item.card.querySelector('#'+item.prefix+'_IAR');
   const raw=String(el?.value??'').replace(',','.');
   const val=raw===''?null:Number(raw);
   if(val!==null&&Number.isFinite(val))totals.set(layer?.value||'?',(totals.get(layer?.value||'?')||0)+val);
   states.push({index,item,iar:String(layer?.value||item.original.IAR||''),
    coef:val!==null&&Number.isFinite(val)?val:-1,
    por:String(item.card.querySelector('#'+item.prefix+'_POR')?.value||item.original.POR||'')});
  }
  const mainSpecies=String(r.M3Pr??'');
  const primary=states.filter(x=>x.iar==='1').sort((a,b)=>b.coef-a.coef||a.index-b.index)[0]||states[0];
  const candidateSpecies=primary?.por||mainSpecies;
  const org=db()?.lesnichestvo?.find(x=>String(x.POS)===String(r.POS)&&String(x.LESN)===String(r.LESN));
  const forestResult=rules?.options?.('ВыделВ','M3TLU',{...r,M3Pr:candidateSpecies},{...r,M3Pr:candidateSpecies},org,ref);
  if(forestResult){
   const previous=String(forestSelect.value??'');
   rules.applySelect(forestSelect,forestResult,{current:previous});
   forestHint.textContent=forestResult.reason||'Тип леса связан с главной породой и лесохозяйственной зоной';
  }else{
   forestSelect.disabled=true;
   forestHint.textContent='Исходный справочник характеристики типа леса не загружен. Сохранённый код остаётся без изменений.';
  }
  for(const state of states){
   const leader=states.filter(x=>x.iar===state.iar).sort((a,b)=>b.coef-a.coef||
      Number(b.por===mainSpecies)-Number(a.por===mainSpecies)||a.index-b.index)[0];
   const isMain=leader?.index===state.index;
   for(const field of ['POL','ZAP']){
    const el=state.item.card.querySelector('#'+state.item.prefix+'_'+field);
    const noStock=field==='ZAP'&&Number(cat.value)===19&&
      (el?.value==null||el.value===''||Number(el.value)===0);
    if(el?.closest('label'))el.closest('label').hidden=!isMain||noStock;
   }
   const heading=state.item.card.querySelector('.wf-rowhead b');
   if(heading)heading.textContent='Порода '+(state.index+1)+(isMain?' · ведущая':' · дополнительная');
  }
  root.querySelector('#wfCompTotal').textContent=[...totals].map(([layer,total])=>'Ярус '+layer+': '+Number(total.toFixed(2))+' / 10').join(' · ');
  const warnings=cards.map(item=>{
   const el=item.card.querySelector('#'+item.prefix+'_POL');
   return window.SolinCategoryRules?.validatePol(cat.value,el?.value,ref);
  }).filter(x=>x?.status==='warning').map(x=>x.message);
  root.querySelector('#wfCompPolicy').textContent=[window.SolinCategoryRules?.guide(cat.value,ref),...new Set(warnings)].filter(Boolean).join(' ');
 }
 cat.addEventListener('change',()=>{
  for(const item of cards){
   const old=item.card.querySelector('#'+item.prefix+'_POL');
   if(old){
    const container=document.createElement('div');
    container.innerHTML=fieldInput('POL',old.value,item.prefix,name,{...r,KU:cat.value});
    const label=container.firstElementChild;old.closest('label').replaceWith(label);
    for(const type of ['input','change'])label.querySelector('input,select').addEventListener(type,refresh);
   }
   setupRowOptions(item);
  }
  refresh();
 });
 root.querySelector('#wfCompAdd').onclick=()=>{if(cards.length>=12)return notify('Максимум 12 пород за одно редактирование');
  const last=cards[cards.length-1],layer=last?.card.querySelector('#'+last.prefix+'_IAR')?.value||'1';
  const added=renderOne({IAR:layer,KOEF:null,POR:null,LET:null,PH:null,PD2:null,KT:null,PROI:null,POL:null,ZAP:null});
  const target=added.card.querySelector('[data-wffield="POR"]');target?.focus();};
 root.querySelector('#wfCompCancel').onclick=closeModal;
 function saveComposition(destination){
  let rows;try{rows=readRows();}catch(e){notify(e.message);return;}
  const desiredKU=cat.value.trim();if(!desiredKU){notify('Выберите категорию угодий выдела');return;}
  if(String(r.KU??'')!==desiredKU&&Object.values(r._children||{}).some(x=>Array.isArray(x)&&x.length)){
   notify('Смена категории угодий при заполненных макетах: создайте новый выдел с нужной категорией. Исходные записи не изменены.');return;
  }
  const layerCoefficients=new Map();
  for(const [i,row]of rows.entries()){
   if(!row.POR||!Number(row.IAR)||!Number(row.KOEF)){notify('Порода '+(i+1)+': выберите ярус, породу и коэффициент');return;}
   if(!Number.isInteger(Number(row.KOEF))||Number(row.KOEF)<1||Number(row.KOEF)>10){notify('Порода '+(i+1)+': коэффициент должен быть от 1 до 10');return;}
   const layer=String(row.IAR),total=(layerCoefficients.get(layer)||0)+Number(row.KOEF);
   layerCoefficients.set(layer,total);
   const policy=window.SolinCategoryRules?.validatePol(desiredKU,row.POL,ref);
   if(policy?.status==='error'){notify('Порода '+(i+1)+': '+policy.message);return;}
   if(Number(desiredKU)===19&&row.ZAP==null)row.ZAP=0;
   const issues=window.solinCore?.validateRow?.(name,row,{...r,KU:Number(desiredKU)})||[];
   if(issues.length){notify('Порода '+(i+1)+': '+issues[0]);return;}
  }
  for(const [layer,total]of layerCoefficients){if(total!==10){notify('Ярус '+layer+': сумма коэффициентов должна составлять 10, сейчас '+total);return;}}
  const main=rows.filter(x=>Number(x.IAR)===1).sort((a,b)=>Number(b.KOEF)-Number(a.KOEF))[0]||rows[0];
  const proposedSpecies=main?.POR||r.M3Pr;
  const chosenForest=String(forestSelect.value??'');
  const currentForest=String(r.M3TLU??'');
  const forestChanged=!forestSelect.disabled&&chosenForest!==currentForest;
  const forestRules=rules?.options?.('ВыделВ','M3TLU',{...r,M3Pr:proposedSpecies},
     {...r,M3Pr:proposedSpecies},db()?.lesnichestvo?.find(x=>String(x.POS)===String(r.POS)&&String(x.LESN)===String(r.LESN)),ref);
  if(forestChanged&&chosenForest&&(
     !['complete','partial'].includes(forestRules?.status)||
     !forestRules.items.some(item=>String(item.value)===chosenForest)
  )){notify('Характеристика типа леса не соответствует выбранной породе и зоне. Данные не изменены.');return;}
  const candidate={...r,KU:Number(desiredKU),M3Pr:r.M3Pr||proposedSpecies,
    M3TLU:forestChanged?(chosenForest||null):r.M3TLU,
    _children:{...r._children,Макет10:rows}};
  const layerCheck=rules?.allowedLayers?.(candidate,ref);
  if(layerCheck?.status==='complete')for(const row of rows){if(rules.currentIsAllowed(row.IAR,layerCheck)===false){notify('Ярус '+row.IAR+' недопустим для выбранной категории угодий');return;}}
  const transition=rules?.validateTransition?.(r,candidate,db()?.lesnichestvo?.[0],ref);
  if(transition?.errors?.length){notify('Не сохранено: '+transition.errors[0].reason);return;}
  const before=JSON.stringify(r);
  r.KU=Number(desiredKU);r._children={...r._children,Макет10:rows};
  if(forestChanged)r.M3TLU=chosenForest||null;
  if(main?.POR&&(r.M3Pr==null||r.M3Pr===''||r.M3Pr===0))r.M3Pr=main.POR;
  if(window.SolinCardCalculations){
   const org=db()?.lesnichestvo?.find(x=>String(x.POS)===String(r.POS)&&String(x.LESN)===String(r.LESN));
   const quarter=window.SolinAddressContext?.resolveQuarter?.(r,db()?.quarters?.[String(r.KV)]);
   const audit=window.SolinCardCalculations.corrections(r,ref,org,quarter);
   for(const issue of audit.issues||[]){
    if(issue.field==='ZAP'&&Number.isInteger(issue.index)){if(r._children.Макет10[issue.index])r._children.Макет10[issue.index].ZAP=Number(issue.expected);}
    else if(issue.field==='M3B')r.M3B=issue.expected==null?null:String(issue.expected);
    else if(issue.field in r)r[issue.field]=issue.expected==null?null:Number(issue.expected);
   }
  }
  try{saveAll(r);}catch(e){Object.assign(r,JSON.parse(before));notify('Не удалось сохранить состав: '+e.message);return;}
  closeModal();if(typeof renderComp==='function')renderComp();
  if(CORE.includes(destination))openMaket(destination);
  else if(['31','32','makets','kt','print','cut'].includes(destination)&&window.SolinCardEditor?.openQuick){
   window.SolinCardEditor.openQuick(r,destination);
  }else if(destination==='print')printCard();
  else if(destination==='control')checkData(r,true);
  notify('Сохранено '+rows.length+' пород. Характеристика типа леса сохраняется в карточке выдела.');
 }
 root.querySelector('#wfCompSave').onclick=()=>saveComposition();
 root.querySelector('#wfQuickNavigate').onclick=()=>{
  const destination=root.querySelector('#wfQuickDestination').value;
  if(destination)saveComposition(destination);
  else notify('Выберите макет');
 };
 for(const row of drafts)renderOne(row);
 if(add&&existing.length)root.querySelector('#wfCompAdd').click();
}

function editMaket(m,index){const r=record();if(!r)return;if(m==='Макет10')return editComposition();
const fields=(db()?.transfSchema?.[m]||[]).filter(n=>!KEY_FIELDS.includes(n)),existing=rowsOf(r,m)[index]||{};
if(typeof openModal!=='function')return;
openModal((index===rowsOf(r,m).length?'Новая запись · ':'Изменение · ')+(window.SolinHuman?.formName(m)||NAMES[m]),
'<div class="wf-form-note">Данные сохраняются только в SOLI-N Field. Оригинальные базы SOLI-N не изменяются.</div>'+
(m==='Макет10'?'<div class="wf-form-note" id="wfM10LayerContext"><label class="wf-field"><span>Категория угодий выдела (KU)</span><select id="wfM10KU" aria-describedby="wfM10LayerHint"></select></label><p id="wfM10LayerHint" role="status" aria-live="polite">Проверяю допустимые ярусы по исходным SKU, SIAR и PIAP…</p><small>Категория относится ко всему выделу, а не только к строке древостоя. Если изменить её здесь, новое значение будет сохранено вместе с древостоем только после подтверждения.</small></div>':'')+
'<div class="formGrid wf-formgrid">'+humanInputs(fields,existing,'wf',m)+'</div>'+
(m==='Макет10'?'<div id="wfBonitetLive" class="wf-bonitet-status" role="status" aria-live="polite"></div>':'')+
'<div class="formActions"><button class="secondary" onclick="closeModal()">Отмена</button><button class="primary" id="wfSaveMaket">Сохранить</button></div>');
// One Access RowSource engine for ALL individual Maket editors.
const rules=window.SolinDependentRules,modalBody=document.querySelector('#modalBody');
const treeCategory=m==='Макет10'?document.getElementById('wfM10KU'):null;
const categoryCode=()=>treeCategory?treeCategory.value:String(r.KU??'');
const categoryCard=()=>treeCategory?{...r,KU:categoryCode()}:r;
if(rules){
 const collect=()=>({...existing,...Object.fromEntries(fields.map(field=>{
  const el=document.getElementById('wf_'+field);
  return [field,el?(el.value===''?null:el.value):existing[field]];
 }))});
 const populateTreeCategory=()=>{
  if(!treeCategory)return;
  const references=window.SOLIN_REFS?.tables;
  const old=treeCategory.options.length?treeCategory.value:String(r.KU??'');
  const candidates=(references?.SKU||[]).filter(entry=>{
   if(entry.KU===null||entry.KU===undefined||String(entry.KU)==='')return false;
   const allowed=rules.allowedLayers({KU:entry.KU},references);
   return ['complete','partial'].includes(allowed.status)&&allowed.items.length>0;
  });
  const choices=[new Option('— Укажите категорию угодий —','')];
  const seen=new Set();
  for(const entry of candidates){
   const value=String(entry.KU);
   if(seen.has(value))continue;
   seen.add(value);
   choices.push(new Option(value+' — '+String(entry.NKU||''),value));
  }
  if(old&&!seen.has(old)){
   const entry=(references?.SKU||[]).find(x=>String(x.KU)===old);
   choices.push(new Option(old+' — '+String(entry?.NKU||'текущая категория')+' (для древостоя не подтверждена)',old));
  }
  treeCategory.replaceChildren(...choices);
  treeCategory.value=old;
  treeCategory.disabled=!references?.SKU?.length||!references?.SIAR?.length;
 };
 const filterAll=()=>{
  const values=collect(),card=categoryCard();
  for(const field of fields){
   const el=document.getElementById('wf_'+field);
   if(!el)continue;
   const result=rules.options(m,field,values,card,db()?.lesnichestvo?.[0]);
   if(result)rules.applySelect(el,result,{current:values[field]});
  }
  if(treeCategory){
   const result=rules.allowedLayers(card,window.SOLIN_REFS?.tables);
   const hint=document.getElementById('wfM10LayerHint');
   if(hint){
    hint.dataset.status=result.status;
    hint.textContent=['complete','partial'].includes(result.status)&&result.items?.length?
     (result.status==='complete'?'Допустимые':'Предварительные')+
       ' ярусы для категории «'+(result.categoryName||categoryCode())+'»: '+
       result.items.map(x=>x.value+' — '+x.label).join('; ')+'. '+result.reason:
     ['complete','partial'].includes(result.status)?
       'Для категории «'+(result.categoryName||categoryCode())+
       '» в SIAR нет подходящих ярусов. '+result.reason:
       (result.reason||'Не удалось определить допустимые ярусы')+
       '. Для выбора требуются категория угодий и исходные SKU, SIAR.';
   }
  }
 };
 populateTreeCategory();
 filterAll();
 modalBody.addEventListener('input',e=>{
  if(e.target===treeCategory||e.target?.matches?.('[data-wffield]'))filterAll();
 });
 modalBody.addEventListener('change',e=>{
  if(e.target===treeCategory||e.target?.matches?.('[data-wffield]'))filterAll();
 });
 if(treeCategory)window.addEventListener('solin-refs-ready',()=>{
  if(!modalBody.isConnected||document.getElementById('wfM10KU')!==treeCategory)return;
  populateTreeCategory();filterAll();
 },{once:true});
}
// K58 preview follows age, height, species, origin, tier, fullness and category.
// Never change actual card data until the Save button is pressed.
if(m==='Макет10'){
 const live=document.getElementById('wfBonitetLive');
 const refreshBonitet=()=>{
  if(!live?.isConnected)return;
  const calc=window.SolinCardCalculations;
  if(!calc){live.textContent='Расчёт бонитета пока недоступен';return;}
  const selected=Object.fromEntries(fields.map(field=>{
   const el=document.getElementById('wf_'+field),value=el?.value;
   return [field,el?(value===''?null:value):existing[field]];
  }));
  const row={...existing,...selected};
  if(row.PROI==null&&row.POR!=null){
   const suggested=rules?.suggestedOrigin?.(row.POR,window.SOLIN_REFS?.tables);
   if(suggested!=null)row.PROI=suggested;
  }
  for(const field of KEY_FIELDS)row[field]=r[field]??null;
  const rows=[...rowsOf(r,'Макет10')];
  if(index>=rows.length)rows.push(row);else rows[index]=row;
  const prospective={...r,KU:treeCategory?treeCategory.value||r.KU:r.KU,
   _children:{...r._children,Макет10:rows}};
  const result=calc.bonitet(prospective,window.SOLIN_REFS?.tables);
  live.dataset.status=result.status;
  if(result.status==='complete')
   live.innerHTML='<b>Расчётный бонитет: '+h(result.expected)+'</b><p>'+h(result.reason)+
    '. Сохранится вместе со строкой Макета 10.</p>';
  else live.innerHTML='<b>Бонитет пока не рассчитан</b><p>'+
   h(result.reason||'Нет достаточных данных')+
   '. Значение останется 0 или ранее сохранённым, пока расчёт не подтверждён.</p>';
  const org=db()?.lesnichestvo?.find(x=>String(x.POS)===String(r.POS)&&String(x.LESN)===String(r.LESN));
  const quarter=window.SolinAddressContext?.resolveQuarter(r,db()?.quarters?.[String(r.KV)]);
  const stock=calc.corrections(prospective,window.SOLIN_REFS?.tables,org,quarter).standStock;
  live.innerHTML+='<p id="wfStockLive">'+(stock.status==='complete'?
   'Общий запас: <b>'+h(stock.expectedPerHa)+' м³/га</b> · '+h(stock.expectedTotal)+' м³ на выдел':
   'Запас: '+h(stock.reason))+'</p>';

 };
 modalBody.addEventListener('input',refreshBonitet);
 modalBody.addEventListener('change',refreshBonitet);
 refreshBonitet();
}
document.querySelector('#wfSaveMaket').onclick=()=>{const container=document.querySelector('#modalBody');let values;try{values=bindInputs(container,fields,'wf',existing);}catch(e){notify(e.message);return;}
const dependent=window.SolinDependentRules,referenceTables=window.SOLIN_REFS?.tables;
 const desiredKU=treeCategory?treeCategory.value.trim():String(r.KU??'').trim();
 const kuChanged=!!treeCategory&&desiredKU!==String(r.KU??'').trim();
 const workingCard=kuChanged?{...r,KU:Number(desiredKU)}:r;
 if(kuChanged){
  if(!desiredKU){notify('Категория угодий выдела не может быть очищена из этого окна.');return;}
  const categoryResult=dependent?.allowedLayers(workingCard,referenceTables);
  if(!['complete','partial'].includes(categoryResult?.status)||!categoryResult.items?.length){
   notify('Не удалось подтвердить новую категорию угодий по SKU → SIAR → PIAP. '+(categoryResult?.reason||''));return;
  }
  if(values.IAR!=null&&dependent.currentIsAllowed(values.IAR,categoryResult)===false&&
     categoryResult.status==='complete'){
   notify('Укажите допустимый ярус для выбранной категории угодий.');return;
  }
 }
 if(dependent&&m==='Макет10'&&values.POR!=null&&values.PROI==null){
  const origin=dependent.suggestedOrigin(values.POR,referenceTables);
  if(origin!==null)values.PROI=origin;
 }
 if(dependent){
  const candidate={...existing,...values};
  for(const field of fields){
   const list=dependent.options(m,field,candidate,workingCard,db()?.lesnichestvo?.[0],referenceTables);
   const good=dependent.currentIsAllowed(candidate[field],list);
   const touched=index>=rowsOf(r,m).length||String(candidate[field]??'')!==String(existing[field]??'');
   if(touched&&good===false&&['complete','empty'].includes(list?.status)&&
      String(candidate[field]??'').trim()!=='0'){
    notify('Недопустимое сочетание в поле «'+(window.SolinHuman?.label(m,field)||field)+'». Выберите значение из справочника для этой карточки.');
    return;
   }
  }
 }
 const before=JSON.stringify(r);const failures=window.solinCore?.validateRow(m,values,workingCard)||[];if(failures.length){notify(failures.join("; "));return;}const target=(r._children=r._children||{});
const list=[...rowsOf(r,m)],base={...existing,...values};
for(const k of KEY_FIELDS)base[k]=r[k]??null;
if(index>=list.length)list.push(base);else list[index]=base;
// One source-backed audit for ALL Maket edits, including changed parent
// choices, Maket 10→16 and Maket 12/23. Do not mutate the record before
// an invalid new dependency is rejected.
const projected={...workingCard,_children:{...r._children,[m]:list}};
const audited=window.SolinDependentRules?.validateTransition?.(
 r,projected,db()?.lesnichestvo?.[0],referenceTables);
if(audited?.errors.length){
 notify('Не сохранено: '+audited.errors[0].reason+
  '. Измените связанные поля через «Изменить карточку».');
 return;
}
if(kuChanged){
 const oldName=referenceTables?.SKU?.find(x=>String(x.KU)===String(r.KU))?.NKU||String(r.KU??'не указано');
 const newName=referenceTables?.SKU?.find(x=>String(x.KU)===desiredKU)?.NKU||desiredKU;
 const unverified=dependent?.allowedLayers({KU:desiredKU},referenceTables)?.status==='partial';
 if(!window.confirm('Изменить категорию угодий ВСЕГО выдела с «'+oldName+'» на «'+newName+'»? '+
  (unverified?'Ярус выбран по SKU и SIAR, но таблица PIAP отсутствует — дополнительная проверка не выполнена. ':'')+
  'Изменение будет сохранено вместе с древостоем.'))return;
 r.KU=Number(desiredKU);
}
target[m]=list;
let calculated=[],k59Check=null,stockEdited=m==='Макет10'&&['IAR','POR','KOEF','LET','PH','PD2','POL','ZAP'].some(k=>String(values[k]??'')!==String(existing[k]??''));
if(m==='Макет10'&&window.SolinCardCalculations){
 const org=db()?.lesnichestvo?.find(x=>String(x.POS)===String(r.POS)&&String(x.LESN)===String(r.LESN));
 const quarter=window.SolinAddressContext?.resolveQuarter(r,db()?.quarters?.[String(r.KV)]);
  const audit=window.SolinCardCalculations.corrections(r,window.SOLIN_REFS?.tables,org,quarter);
 calculated=audit.issues;k59Check=audit.stockPerHectare;
 for(const issue of calculated){
  if(issue.field==='ZAP'&&Number.isInteger(issue.index))r._children?.Макет10?.[issue.index]&&(r._children.Макет10[issue.index].ZAP=Number(issue.expected));
  else r[issue.field]=issue.expected===null?null:issue.field==='M3B'?String(issue.expected):Number(issue.expected);
 }
}
try{saveAll(r);}catch(e){Object.assign(r,JSON.parse(before));notify('Не удалось сохранить: '+e.message);return;}
closeModal();
// Maket10 calculations previously updated r.M3B but not the visible stand
// summary, leaving «Не рассчитан» on screen despite a successful K58 update.
if(m==='Макет10'&&typeof renderComp==='function')renderComp();
else openMaket(m);
notify('Сохранено: '+m);
if(m==='Макет10'&&(calculated.length||stockEdited)){
 const k59Verified=k59Check?.status==='complete';
 const normativeFix=calculated.some(x=>x.field==='ZAP'&&x.kind!=='companion-zero');
 const companionFix=calculated.some(x=>x.kind==='companion-zero');
 const dependent=calculated.filter(x=>x.field==='STUR1'||x.field==='STUR');
 const previous=calculated.filter(x=>x.field!=='ZAP'&&x.field!=='STUR1'&&x.field!=='STUR');
 const reason=h(k59Check?.reason||'Нет однозначного результата нормативного расчёта');
 const heading=normativeFix?'К59: нормативный запас автоматически исправлен':
   companionFix?'Макет 10: запас примеси сброшен на 0':
   k59Verified?'К59: введённый запас проверен по нормативу':'Запас НЕ проверен по нормативу К59';
 const explanation=normativeFix?
   '<p>Значение ZAP заменено по таблице SOLI-N Szap/SzapCK. Итоги STUR1 и STUR пересчитаны из <b>нормативного</b> запаса.</p>':
   companionFix?
    '<p>У примесной породы запас обнулён. Весь запас яруса принадлежит строке ведущей породы. '+(k59Verified?'Норматив К59 подтверждён.':'Сам норматив К59 не подтверждён: '+reason)+'.</p>':
   k59Verified?
     '<p>К59 подтвердил запас в макете 10. Пересчитаны зависимые итоги.</p>':
     '<p><b>Внимание: введённый запас ZAP не подтверждён по К59.</b> Причина: '+reason+'.</p>'+
     '<p>'+(dependent.length?'STUR1 и STUR пересчитаны из <b>введённого</b> ZAP. Это арифметический пересчёт, а не исправление запаса по нормативу.':
        'Значение ZAP сохранено как введённое без нормативного подтверждения.')+'</p>';
 const fields=calculated.map(x=>'<tr><td>'+h(x.label)+'</td><td>'+h(x.previous)+'</td><td><b>'+h(x.expected)+'</b></td><td>'+h(x.reason)+'</td></tr>').join('');
 const table=calculated.length?
   '<div style="overflow-x:auto"><table class="wf-calc-warning"><thead><tr><th>Показатель</th><th>Было</th><th>Стало</th><th>Основание</th></tr></thead><tbody>'+fields+'</tbody></table></div>':'';
 const zones=k59Check?.zoneOptions||[];
 const zoneInfo=k59Check?.status==='unsupported-zone'?
   '<section class="wf-form-note" style="margin:12px 0"><strong>Варианты из Szap'+
   (k59Check.kpz==null?'':'+Slxr для Kpz '+h(k59Check.kpz))+':</strong> '+
   (zones.length?zones.map(z=>'<span style="display:block">'+h(z.value)+' — '+h(z.name)+'</span>').join(''):
     h((k59Check.availableZones||[]).join(', ')||'нет однозначного варианта'))+
   '<p>Это <b>варианты для проверки</b>, а не автоматически выбранная зона. Для квартала '+h(r.KV)+
   ' уточните код Klxr. Правильную зону нельзя определить только по KTO.</p></section>':'';
 const stock=window.SolinCardCalculations?.standStock(r),parts=window.SolinCardCalculations?.stockBreakdown?.(r);
 const stockInfo='<section class="wf-form-note"><b>Проверка итогового запаса Макета 5</b><p>'+
  (stock?.status==='complete'?
   'Все живые породы: STUR1 = '+h(stock.expectedPerHa)+' м³/га; STUR = '+h(stock.expectedTotal)+' м³ на выдел. Расчёт из введённых ZAP; К59 проверяется отдельно.':
   'Автоматический пересчёт STUR не выполнен: '+h(stock?.reason||'нет исходных данных'))+'</p>'+
  (stock?.status==='complete'?'<p>По ярусам: '+h(stock.byLayer.map(x=>'№'+x.iar+' — '+x.zap+
   ' м³/га; ведущая порода '+x.por+'; состав '+x.composition.map(p=>p.por+(p.coef===null?'':' '+p.coef)).join(' + ')).join('; '))+
   '. ZAP ведущей породы описывает запас всего яруса и не повторяется на примеси.</p>':'')+
  (parts?.singleTrees?.length?'<p>Ярус 7: единичные деревья '+h(parts.singleTreesPerHa)+' м³/га, '+h(parts.singleTreesTotal)+' м³ на выдел — отдельно от STUR.</p>':'')+
  (parts?.freshDeadwood?.length?'<p>Ярус 8: свежий сухостой '+h(parts.freshDeadwoodPerHa)+' м³/га, '+h(parts.freshDeadwoodTotal)+' м³ на выдел — отдельно от живого древостоя.</p>':'')+
  (parts?.drywoodPerHa!=null?'<p>M4SS: сухостой '+h(parts.drywoodPerHa)+' м³/га, '+h(parts.drywoodTotal)+' м³ на выдел. Не суммируем с ярусом 8: возможен повторный учёт.</p>':'')+
  '</section>';
 const quarterLink=k59Check?.status==='unsupported-zone'?
    '<button type="button" id="wf-k59-open-quarter" class="secondary">Открыть квартал '+h(r.KV)+'</button>':'';
 openModal(heading,explanation+stockInfo+zoneInfo+table+quarterLink+
  '<button type="button" class="primary" onclick="closeModal()">Понятно</button>');
 const link=document.getElementById('wf-k59-open-quarter');
 if(link)link.onclick=()=>{
  closeModal();
  if(typeof show==='function')show('quartersScreen');
  const q=db()?.quarters?.[String(r.KV)];
  const rows=q?.quarterRows?.length?q.quarterRows:[q?.meta||{}];
  const index=rows.findIndex(row=>
   String(row.POS??r.POS)===String(r.POS)&&String(row.LESN??r.LESN)===String(r.LESN)&&
   String(row.KGLF??'')===String(r.KGLF??'')&&
   (!r.Fzona||String(row.Fzona??'')===String(r.Fzona??''))&&
   (!r.KlxrVD||String(row.Klxr??'')===String(r.KlxrVD??'')));
  // Open the exact original quarter form, not a new secondary modal.
  if(index>=0&&typeof window.solinEditQuarter==='function')
   window.solinEditQuarter(String(r.KV),index);
  else if(typeof openQuarter==='function')openQuarter(String(r.KV),r.KGLF);
 };
}

};}
function saveAll(r){const makets={};for(const m of CORE){const list=rowsOf(r,m);makets[m]=list.map(row=>({...row}));}store(r,{makets,base:Object.fromEntries(EDIT_FIELDS.map(k=>[k,r[k]??null]))});}
function deleteMaket(m,index){const r=record();if(!r)return;
 const list=rowsOf(r,m).filter((_,i)=>i!==index);
 const projected={...r,_children:{...r._children,[m]:list}};
 const org=db()?.lesnichestvo?.[0];
 const result=window.SolinDependentRules?.validateTransition?.(
  r,projected,org,window.SOLIN_REFS?.tables);
 if(result?.errors.length){
  notify('Удаление остановлено: '+result.errors[0].reason+
   '. Сначала согласуйте связанные макеты в «Изменить карточку».');
  return;
 }
 if(!confirm('Удалить только эту запись '+m+' №'+(index+1)+' из локальной мобильной копии?'))return;
 const before=JSON.stringify(r);r._children[m]=list;
 try{saveAll(r);openMaket(m);notify('Запись удалена локально');}
 catch(e){Object.assign(r,JSON.parse(before));notify(e.message);}
}
function editBase(){const r=record();if(!r)return;
// An unsaved preview must still be committed as a NEW stand. Once the
// editor saves it into q.compartments, subsequent edits are normal edits.
const q=db()?.quarters?.[String(r.KV)];
const isNew=!!q&&!q.compartments?.includes(r);
if(window.SolinCardEditor)return window.SolinCardEditor.open(r,{isNew});
openModal('Выдел '+r.VD+' · квартал '+r.KV,'<div class="wf-form-note">Редактирование основной таблицы «Выдел»; состав макетов редактируется в отдельных разделах.</div><div class="formGrid wf-formgrid">'+humanInputs(EDIT_FIELDS,r,'wfb','ВыделВ')+'</div><div class="formActions"><button class="secondary" onclick="closeModal()">Отмена</button><button class="primary" id="wfSaveBase">Сохранить выдел</button></div>');
document.querySelector('#wfSaveBase').onclick=()=>{
 let fields;try{fields=bindInputs(document.querySelector('#modalBody'),EDIT_FIELDS,'wfb',r);}catch(e){notify(e.message);return;}
 const p=Number(String(fields.PLV).replace(',','.'));if(!Number.isFinite(p)||p<=0){notify('Площадь выдела должна быть положительной');return;}
 const failed=(window.solinCore?.validateRow('ВыделВ',fields,r)||[]).filter(msg=>{const field=msg.split(':')[0];return String(fields[field]??'')!==String(r[field]??'')});if(failed.length){notify(failed.join('; '));return;}const transition=window.SolinDependentRules?.validateTransition?.(
 r,{...r,...fields,PLV:p},db()?.lesnichestvo?.[0],window.SOLIN_REFS?.tables);
 if(transition?.errors.length){notify('Проверьте зависимые поля: '+transition.errors[0].reason);return;}
 const before=JSON.stringify(r);Object.assign(r,fields,{PLV:p});
 try{saveAll(r);}catch(e){Object.assign(r,JSON.parse(before));notify(e.message);return;}
 closeModal();if(typeof renderComp==='function')renderComp();if(typeof refresh==='function')refresh();notify('Поля выдела сохранены');
};}
function exitCard(){const r=record();if(!r)return;
 // Макет 5: sum all recorded live species and layers, never copy the
 // first arbitrary Maket10.ZAP into STUR1 when leaving the card.
 const stock=window.SolinCardCalculations?.standStock(r);
 // Never silently replace already populated historical Access totals merely
 // by leaving the screen: the new mixed-species Field arithmetic can differ
 // from the audited original main-species-only Maket10ZAP subset.
 const emptyVolume=v=>v===null||v===undefined||v===''||Number(v)===0;
 if(stock?.status==='complete'&&emptyVolume(r.STUR1)&&emptyVolume(r.STUR)){
  const original1=r.STUR1,original=r.STUR;
  r.STUR1=stock.expectedPerHa;r.STUR=stock.expectedTotal;
  try{saveAll(r);}catch(e){r.STUR1=original1;r.STUR=original;notify('Не сохранилось: '+e.message);return;}
  notify('Пересчитано по макету 10: запас на гектар '+original1+' → '+r.STUR1+
   ', запас выдела '+original+' → '+r.STUR);
 }
 if(typeof show==='function')show('quartersScreen');}
function checkData(r,modal){if(!r)return;const msgs=[];
const area=Number(r.PLV);if(!(area>0))msgs.push({status:'bad',message:'Площадь PLV не задана или не положительна'});
if(r.KU===null||r.KU===undefined||r.KU==='')msgs.push({status:'bad',message:'Не указана категория угодий KU'});
const seen=new Map();for(const m of CORE){for(const [i,row]of rowsOf(r,m).entries()){
 if(m==='Макет10'){const age=Number(row.LET),h=Number(row.PH),p=Number(row.POL);if(row.LET!=null&&row.LET!==''&&age<0)msgs.push({status:'bad',message:m+' строка '+(i+1)+': возраст меньше нуля'});if(row.PH!=null&&row.PH!==''&&h<0)msgs.push({status:'bad',message:m+' строка '+(i+1)+': высота отрицательная'});if(row.POL!=null&&row.POL!==''&&(p<0||p>1))msgs.push({status:'warn',message:m+' строка '+(i+1)+': полнота вне обычного диапазона 0–1 (проверь шкалу)'});}
 if(m==='Макет23'){for(let k=1;k<=8;k++){const v=row['K'+k];if(v!==''&&v!==null&&v!==undefined){seen.set(String(v), (seen.get(String(v))||0)+1)}}}
 }}
 for(const [code,count]of seen)if(count>1)msgs.push({status:'warn',message:'Макет 23: код особенности '+code+' встречается '+count+' раза'});
 const audit=window.SolinCardCalculations?.cardIntegrity?.(r);
 if(audit?.issues?.length)for(const item of audit.issues)msgs.push({status:item.status==='bad'?'bad':'warn',message:item.message});
 const stock=window.SolinCardCalculations?.standStock(r);
 const parts=window.SolinCardCalculations?.stockBreakdown?.(r);
 const html='<div class="wf-form-note">Локальная предварительная проверка, не замена 142 контрольных форм оригинальной SOLI-N.</div><p><b>Найдено замечаний:</b> '+msgs.length+'</p>'+
  msgs.map(x=>'<div class="wf-check '+x.status+'">'+h(x.message)+'</div>').join('')+
  (msgs.length===0?'<div class="wf-check ok">По базовым правилам ошибок не обнаружено.</div>':'')+
  '<div class="wf-form-note"><b>Макет 5 · запас всех пород живых ярусов</b><p>'+
  (stock?.status==='complete'?h(stock.expectedPerHa)+' м³/га × '+h(stock.area)+' га = '+h(stock.expectedTotal)+' м³':
   'Расчёт не завершён: '+h(stock?.reason||'нет исходных данных'))+
  '</p><p>Свежий сухостой (ярус 8): '+h(parts?.freshDeadwoodPerHa??'—')+
  ' м³/га; отдельно M4SS: '+h(parts?.drywoodPerHa??'—')+
  ' м³/га; единичные деревья (ярус 7): '+h(parts?.singleTreesPerHa??'—')+
  ' м³/га. Все три категории учитываются отдельно во избежание повторного подсчёта.</p></div>'+
  '<button class="primary" onclick="closeModal()">Закрыть</button>';
if(modal)openModal('Контроль выдела '+r.KV+'-'+r.VD,html);
return msgs;}
function printCard(){const r=record();if(!r)return;let html='<h1>Карточка таксации SOLI-N Field</h1><p>Лесничество: '+h(db()?.source?.forestDistrict||'')+'</p><p><b>Квартал '+h(r.KV)+' · Выдел '+h(r.VD)+'</b> · Площадь '+h(r.PLV)+' га</p>';
html+='<h2>Основные сведения</h2><table>'+EDIT_FIELDS.filter(k=>r[k]!=null&&r[k]!=='').map(k=>'<tr><th>'+h(window.SolinHuman?.label('ВыделВ',k)||FORM_LABELS[k]||k)+'</th><td>'+h(r[k])+'</td></tr>').join('')+'</table>';
for(const m of CORE){const rows=rowsOf(r,m);if(!rows.length)continue;html+='<h2>'+h(m)+' · '+h(window.SolinHuman?.formName(m)||NAMES[m])+'</h2>';rows.forEach((row,i)=>{html+='<h3>Запись '+(i+1)+'</h3><table>'+Object.entries(row).filter(([k,v])=>!KEY_FIELDS.includes(k)&&v!==null&&v!==undefined&&v!=='').map(([k,v])=>'<tr><th>'+h(window.SolinHuman?.label(m,k)||LABELS[k]||k)+'</th><td>'+h(v)+'</td></tr>').join('')+'</table>';});}
const win=window.open('','_blank');if(!win){notify('Разреши открытие нового окна для печати');return;}
win.document.write('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Таксационная карточка</title><style>body{font:14px Arial;padding:20px;color:#17251d}table{border-collapse:collapse;width:100%;margin-bottom:10px}th,td{border:1px solid #b7c9ba;padding:6px;text-align:left}th{width:44%;background:#eef5ec}h2{border-bottom:1px solid #b4cab5;padding:8px 0}h3{font-size:14px}@media print{button{display:none}}</style><button onclick="print()">Печать</button>'+html+'<p><small>Предварительная мобильная карточка, не официальный отчёт Access.</small></p></html>');
win.document.close();}
function quarterToolbar(k){
 const box=document.querySelector('#quarters');
 if(!box||!db()?.quarters?.[k])return;
 box.querySelector('#wfQuarterToolbar')?.remove();
 const bar=document.createElement('div');
 bar.id='wfQuarterToolbar';
 bar.className='wf-toolbar';
 box.querySelector('.screenHead')?.after(bar);
}
function download(name,payload){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function setup(){
 const menu=document.querySelector('#menuScreen .workspace');
 if(menu&&!menu.querySelector('#wfForestDependencyAudit')){
  const action=document.createElement('button');action.id='wfForestDependencyAudit';
  action.className='menuRow';action.textContent='Проверить связи полей всего лесничества ›';
  action.onclick=()=>window.SolinDependencyAudit?.open(
   Object.values(db()?.quarters||{}).flatMap(q=>q.compartments||[]),
   {caption:'Лесничество '+(db()?.lesnichestvo?.[0]?.NOS||'')});
  menu.querySelector('h2')?.after(action);
 }
 const prev=window.renderComp;
 if(typeof prev==='function')window.renderComp=function(){if(record())localPatch(record());prev();currentMaket='Макет10';cardToolbar();openMaket(currentMaket);};
 const oldQuarter=window.openQuarter;
 if(typeof oldQuarter==='function')window.openQuarter=function(k,...args){oldQuarter(k,...args);quarterToolbar(k);};
 const mapShow=window.showCmfSheet;
 if(typeof mapShow==='function')window.showCmfSheet=function(feature,latlng,layer){
   mapShow(feature,latlng,layer);
   const p=feature?.properties||{},keys=cmfStandKeys(feature),kv=keys.kv,vd=keys.vd;
   if(kv==null||vd==null)return;
   const button=document.createElement('button');button.className='wf-card-from-map';button.type='button';
   button.textContent='▦ Открыть карточку таксации '+kv+'-'+vd;
   button.onclick=()=>{
     const q=db()?.quarters?.[String(kv)],r=q?.compartments?.find(x=>String(x.VD)===String(vd));
     if(!r){notify('Выдел '+kv+'-'+vd+' есть на карте, но не найден в текущей базе таксации');return;}
     closeCmfSheet();current=r;if(typeof renderComp==='function')renderComp();if(typeof show==='function')show('card');
   };
   document.querySelector('#cmfSheet .cmfCard')?.appendChild(button);
 };
 const oldBoot=window.boot;
 if(typeof oldBoot==='function')window.boot=async function(){await oldBoot();apply();if(typeof refresh==='function')refresh();};
 window.addEventListener('solin-ready',()=>{apply();refresh()});
 window.solinWorkflow={openMaket,checkData,editBase,editMaket,printCard,showWholeCard,exitCard,saveAll};
}
if(document.querySelector('#menuScreen .workspace'))setup();else document.addEventListener('DOMContentLoaded',setup,{once:true});
})();
