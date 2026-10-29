/* Russian presentation layer. Names come from original Access form captions and
 * form-scoped RowSource bindings; unknown/ambiguous meanings stay explicit. */
(()=>{'use strict';
const dict=window.SOLIN_DICTIONARY||{fields:{},formNames:{},originalForms:{},referenceForms:{}};
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const database=()=>typeof D!=='undefined'?D:null;
const canonical=f=>['Выдел','ВыделКрат','Карточка'].includes(f)?'ВыделВ':f;
const normalize=v=>{const s=String(v??'').trim();return /^[-+]?\d+(\.\d+)?$/.test(s)?String(Number(s)):s;};
const member=(r,k)=>r?.[k]??r?.[Object.keys(r||{}).find(x=>x.toLowerCase()===k.toLowerCase())];
const clean=v=>String(v??'').replace(/\\015\\012/g,' ').replace(/\s+/g,' ').trim();
const expansions={
'Беpеза':'Берёза','Береза бородав.':'Берёза бородавчатая','Абелия щитковид.':'Абелия щитковидная','Боярышник куст.':'Боярышник кустарниковый','Береза кустарник.':'Берёза кустарниковая','Вяз мелколист.':'Вяз мелколистный','Ель обыкновен.':'Ель обыкновенная','Ива острол.(шелюга)':'Ива остролистная (шелюга)','Можжевельник куст.':'Можжевельник кустарниковый','Можжевельник куст.(туркест.)':'Можжевельник кустарниковый (туркестанский)','Миндаль куст.':'Миндаль кустарниковый','Арша (мож. древ.)':'Арша (можжевельник древовидный)','Арша (мож.древовидный)':'Арша (можжевельник древовидный)','Слива согд. (алыча)':'Слива согдийская (алыча)','Смородина золот.':'Смородина золотистая','Сосна обыкнов.':'Сосна обыкновенная','Тополь бальзамич.':'Тополь бальзамический','Тополь пирамидал.':'Тополь пирамидальный','Черкез (Солян.Рихтера)':'Черкез (солянка Рихтера)',
'длительная постеп. рубка':'Длительная постепенная рубка','постеп. рубка (закл. прием)':'Постепенная рубка (заключительный приём)','постеп. 2-х приёмная рубка':'Постепенная рубка в два приёма','постеп. 3-х приёмная рубка':'Постепенная рубка в три приёма','сплошная санрубка':'Сплошная санитарная рубка','выборочная санрубка':'Выборочная санитарная рубка','уборка захламлен. и сухостоя':'Уборка захламлённости и сухостоя','естест. заращивание':'Естественное заращивание','дополнение л/к':'Дополнение лесных культур','без хозмероприятий':'Без хозяйственных мероприятий','под с/х пользование':'Под сельскохозяйственное пользование','пов.улучш.сен.и пастбищ':'Поверхностное улучшение сенокосов и пастбищ','кор.улучш.сен.и пастбищ':'Коренное улучшение сенокосов и пастбищ','создание минполос':'Создание минерализованных полос','капремонт':'Капитальный ремонт','устройство подкор.площадок':'Устройство подкормочных площадок','оф.видовой точки':'Оформление видовой точки','рег.рек.нагрузки':'Регулирование рекреационной нагрузки','устройство ППР':'Устройство противопожарного разрыва','корчёвка минполос':'Корчёвка минерализованных полос',
'Насаждение расстр.рубками':'Насаждение, расстроенное рубками','Насаждение естествен. с примесью л/к':'Естественное насаждение с примесью лесных культур','Насаждение с л\\к под пологом':'Насаждение с лесными культурами под пологом','Несомкн.к.под полог.':'Несомкнувшиеся лесные культуры под пологом','Сомкн.к.под полог.':'Сомкнувшиеся лесные культуры под пологом','Ест..воз. в л/к.':'Естественное возобновление в лесных культурах','Несомк.к реконстр.':'Несомкнувшиеся культуры реконструкции','2 ярус древостроя':'2 ярус древостоя','неудовлет.':'Неудовлетворительное','удовлет.':'Удовлетворительное','полное высых.':'Полное высыхание','частичное высых.':'Частичное высыхание','снижение рекреац. функц.':'Снижение рекреационной функции','снижение защит. функц.':'Снижение защитной функции',
'врем.использ.под с/х польз.':'Временное сельскохозяйственное использование','в выделе пост.пробн.площ.':'В выделе постоянная пробная площадь','на площ.врем.лесной склад':'На площади временный лесной склад','усыхание от избыточ.увлажнения':'Усыхание от избыточного увлажнения','в выделе ландшафт.культуры':'В выделе ландшафтные культуры','гос.лесной памятник природы':'Государственный лесной памятник природы','в выд.водопой для диких животн':'В выделе водопой для диких животных','л/к с примесью ест.возобновл.':'Лесные культуры с примесью естественного возобновления','почва подготовлена под л.к.':'Почва подготовлена под лесные культуры','в выд.малые архитектурн.формы':'В выделе малые архитектурные формы','погибшие л/к (списаны)':'Погибшие лесные культуры (списаны)','погибшие л/к (не списаны)':'Погибшие лесные культуры (не списаны)','приживаемость л/к неравномерн.':'Неравномерная приживаемость лесных культур','главная порода л/к выпала':'Главная порода лесных культур выпала','состояние л/к хорошее':'Состояние лесных культур хорошее','состояние л/к удовлетворит.':'Состояние лесных культур удовлетворительное','состояние л/к неудовлетворит.':'Состояние лесных культур неудовлетворительное','погибшие л/к старших возрастов':'Погибшие лесные культуры старших возрастов','в выделе ЛЭП':'В выделе линия электропередачи','в выделе географические л/к':'В выделе географические лесные культуры','в выделе опытные л/к':'В выделе опытные лесные культуры','проектируется разрубка ППР':'Проектируется разрубка противопожарного разрыва','доп.разрубка 8 м на ППР':'Дополнительная разрубка 8 м на противопожарном разрыве','в выделе КПП':'В выделе контрольно-пропускной пункт'
};
function text(v){const s=clean(v);return expansions[s]||s;}
const extra=[
 ['Квартал','KGLF','Sples','KOD','T1'],['ВыделВ','KGLF','Sples','KOD','T1'],['Квартал','Fzona','SFZ','KFZ','NFZ'],['ВыделВ','Fzona','SFZ','KFZ','NFZ'],['Квартал','Kpz','Spzon','Kpz','Npz'],['Квартал','Klxr','Slxr','Klxz','Nlxr'],['ВыделВ','KlxrVD','Slxr','Klxz','Nlxr'],['ВыделВ','ErV','SErv','KErv','Erv'],['ВыделВ','ErCt','SErCt','KErct','Erct'],['Макет21','SD','SDL','KSD','Klass'],['Макет16','Por16','SDP','KPC','NDP'],['Макет14','KU','SKU','KU','NKU'],['Макет27','KU_St','SKU','KU','NKU']
].map(([form,field,table,code,label])=>({form,field,table,code,label}));
const localLists={'ВыделВ.M3B':{'1Б':'Класс Iб','1А':'Класс Iа','1':'Класс I','2':'Класс II','3':'Класс III','4':'Класс IV','5':'Класс V','5А':'Класс Vа','5Б':'Класс Vб'},'Квартал.Dost':{'1':'Труднодоступный','2':'Доступный'},'Квартал.Rel':{'1':'Равнинный','2':'Горный'}};
const sources=()=>[...(window.SOLIN_LOOKUP_SOURCES||[]),...extra];
function source(form,field){form=canonical(form);return sources().find(s=>s.form===form&&s.field===field);}
const cache=new Map();let cachedTables=null;
function lookup(form,field){form=canonical(form);const key=form+'.'+field;if(localLists[key])return localLists[key];const src=source(form,field);if(!src)return null;const tables=window.SOLIN_REFS?.tables;
 if(tables!==cachedTables){cache.clear();cachedTables=tables;}if(cache.has(key))return cache.get(key);
 let rows=tables?.[src.table];if(!rows&&src.table==='SDP_Tip')rows=tables?.SDP;
 if(!rows){const legacy=database()?.scopedLookups?.[form]?.[field];return legacy?Object.fromEntries(Object.entries(legacy).map(([k,v])=>[k,text(v)])):{};}
 const values=new Map();for(const row of rows){let code=member(row,src.code),name=member(row,src.label);if(name==null&&src.table==='SDP_Tip'){const match=tables?.SDP?.find(r=>normalize(r.KPC)===normalize(code));name=match?.NDP;}if(code==null)continue;const k=normalize(code);if(!values.has(k))values.set(k,new Set());if(name!=null&&clean(name)!=='')values.get(k).add(text(name));}
 const out={};for(const [k,names] of values)out[k]=names.size===1?[...names][0]:names.size>1?'Неоднозначное значение (код '+k+')':'Не указано'+(k?' (код '+k+')':'');cache.set(key,out);return out;
}
function label(form,field){form=canonical(form);return dict.fields[form]?.[field]||dict.fields['ВыделВ']?.[field]||'Служебное поле';}
function isTechnical(form,field){form=canonical(form);return (dict.unresolved?.[form]||[]).includes(field)||!dict.fields[form]?.[field]&&!dict.fields['ВыделВ']?.[field];}
function value(form,field,v,row){if(v==null||v==='')return 'Не указано';const list=lookup(form,field);if(list){const k=normalize(v);return list[k]??'Неизвестное значение (код '+String(v)+')';}if(isTechnical(form,field))return String(v);if(typeof v==='number'||/^[-+]?\d+(\.\d+)?$/.test(String(v)))return Number(v).toLocaleString('ru-RU',{maximumFractionDigits:3});return text(v);}
function codeLabel(code,label){
 const k=String(code??'').trim(),n=String(label??'').trim();
 if(!k)return n||'Не указано';
 if(!n||n===k||n.startsWith(k+' — '))return n||k;
 return k+' — '+n;
}
function input(name,v='',prefix='wf',form='ВыделВ'){
 const id=prefix+'_'+name,list=lookup(form,name),str=String(v??'');
 const phantom=form==='Макет10'&&['KOEF','LET','PH','PD2','KT','POL','SPS','ZAP'].includes(name);
 let control;
 if(list){
  const current=normalize(v),entries=Object.entries(list).filter(([k])=>k!=='');
  const exists=Object.prototype.hasOwnProperty.call(list,current);
  control='<select id="'+h(id)+'" data-wffield="'+h(name)+'"><option value="">Не указано</option>'+
   (!exists&&str?'<option selected value="'+h(str)+'">'+h(codeLabel(str,value(form,name,v)))+'</option>':'')+
   entries.map(([k,n])=>'<option value="'+h(current===k?str:k)+'"'+(current===k?' selected':'')+' title="Исходный код: '+h(k)+'">'+h(codeLabel(k,n))+'</option>').join('')+'</select>';
 }else{
  control='<input id="'+h(id)+'" data-wffield="'+h(name)+'"'+(phantom?' data-phantom-zero="1" inputmode="decimal"':'')+
    ' autocomplete="off" value="'+h(str)+'" placeholder="'+(phantom?'0':'Не указано')+'">';
 }
 return '<label class="wf-field'+(isTechnical(form,name)?' human-technical-field':'')+'" title="Поле исходной базы: '+h(name)+'"><span>'+h(label(form,name))+(isTechnical(form,name)?' <small>'+h(name)+' · назначение не подтверждено</small>':'')+'</span>'+control+'</label>';
}
// An actual saved 0 remains a valid value (e.g. origin 0 means seed-grown).
// While typing, make a visible 0 behave like a placeholder, but restore it if untouched.
document.addEventListener('focusin',event=>{
 const el=event.target;if(!el?.matches?.('input[data-phantom-zero="1"]')||el.readOnly||el.disabled)return;
 if(el.value==='0'){el.dataset.zeroBeforeFocus='1';el.dataset.zeroEdited='0';el.value='';}
},true);
document.addEventListener('input',event=>{
 if(event.target?.dataset?.zeroBeforeFocus==='1')event.target.dataset.zeroEdited='1';
},true);
document.addEventListener('focusout',event=>{
 const el=event.target;if(el?.dataset?.zeroBeforeFocus!=='1')return;
 if(el.dataset.zeroEdited==='0'&&el.value==='')el.value='0';
 delete el.dataset.zeroBeforeFocus;delete el.dataset.zeroEdited;
},true);
const referenceTitles={SKU:'Категории угодий',SDP:'Древесные и кустарниковые породы',SDP_Tip:'Группы древесных пород',SIAR:'Ярусы древостоя',SPR:'Происхождение и возрастные шкалы',SProi:'Происхождение насаждений',SBon:'Классы бонитета',SLM:'Лесохозяйственные мероприятия',Sples:'Категории государственного лесного фонда',SFZ:'Функциональные зоны',Spzon:'Природные зоны',Slxr:'Лесохозяйственные зоны',STL:'Типы леса',SErv:'Виды эрозии',SErCt:'Степени эрозии',SOZU:'Особо защитные участки',SSR:'Способы рубки',SPP:'Способы подготовки почвы',SSSK:'Способы создания лесных культур',SSLK:'Состояние лесных культур',SPG:'Причины повреждения и гибели',SBR:'Вредители и болезни',SSP:'Степени повреждения',SSD:'Состояние линейных объектов',SND:'Назначение дороги',STPD:'Типы покрытия дороги',SSV:'Сезоны доступности дорог',STP:'Травяные растения и ягодники',SUR:'Учётные категории растений',SPV:'Анализ выполнения мероприятий',SOXM:'Оценки выполненных мероприятий',SNMP:'Причины невыполнения мероприятий',SNeds:'Недревесное сырьё',SSbor:'Способы сбора сырья',SPN:'Пользователи сельскохозяйственных угодий',SKSU:'Качество сельскохозяйственных угодий',STC:'Типы сенокосов и пастбищ',SSU:'Состояние сельскохозяйственных угодий',STB:'Типы болот',SVBR:'Болотная растительность',SKPD:'Категории потерь древесины',SMP:'Места потерь древесины',SLX:'Типы ландшафта',SOE:'Эстетическая оценка',SOR:'Рекреационная оценка',SUN:'Устойчивость насаждений',SOPP:'Проходимость',SOPR:'Просматриваемость',SDL:'Стадии дигрессии',SOV:'Особенности выдела',SVP:'Назначение плантаций',SDD:'Доступность для транспорта',STT:'Типы транспорта',SGP:'Густота подлеска',SEdiz:'Единицы измерения',STLU:'Типы лесорастительных условий',SSLes:'Состояние насаждений'};
function tableTitle(name){if(referenceTitles[name])return referenceTitles[name];const f=dict.referenceForms?.[name];return f?.caption&&/[А-Яа-яЁё]{3}/.test(f.caption)?clean(f.caption):'Расчётная таблица';}
const columnTitles={KPC:'Код породы',NDP:'Порода',NDPKZ:'Название на казахском',NKU:'Категория угодий',KU:'Код угодья',KIAR:'Код яруса',NIAR:'Ярус',Ia:'Группа ярусов',KM:'Код мероприятия',NMR:'Мероприятие',M3B:'Класс бонитета',KTL:'Код типа леса',NTL:'Тип леса',NTLKZ:'Название на казахском',GPor:'Главная порода',Lxz:'Лесохозяйственная зона',KLPoj:'Класс пожарной опасности',NPV:'Анализ выполнения',NOXM:'Оценка выполнения',NPN:'Причина невыполнения',NPL:'Пользователь угодья',Nkah:'Качество угодья',NTS:'Тип угодья',NSU:'Состояние угодья',NTB:'Тип болота',NBR:'Растительность',NPD:'Категория потерь',NMP:'Место потерь',NVBR:'Тип ландшафта',NOE:'Эстетическая оценка',NOR:'Рекреационная оценка',NUN:'Устойчивость',NOPP:'Характеристика',Klass:'Стадия дигрессии',NOV:'Особенность',NVP:'Назначение плантации',NDD:'Доступность',NTT:'Транспорт',GUS:'Густота',Nsbor:'Способ сбора',NNeds:'Недревесное сырьё',Kpz:'Природная зона',Npz:'Природная зона',Klxz:'Код лесохозяйственной зоны',Nlxr:'Лесохозяйственная зона',KOD:'Код категории',T1:'Категория лесного фонда',KFZ:'Код зоны',NFZ:'Функциональная зона',NFZK:'Краткое название',NOZ:'Особо защитный участок',NEX:'Экспозиция склона',Erv:'Вид эрозии',Erct:'Степень эрозии'};
const specForTable=name=>sources().find(x=>x.table===name)||({Sples:['KOD','T1'],SFZ:['KFZ','NFZ'],STL:['KTL','NTL'],SPN:['KPL','NPL'],SEdiz:['KEdiz','NEdiz'],SProi:['KProi','NProi'],SBon:['M3B','M3B'],SSLes:['Ksos','Sosto'],SUR:['KUK','NUK']}[name]||[]).reduce((o,k,i)=>(o[i?'label':'code']=k,o),{});
const cardMakets={OZU:1,CkEk:1,CkKr:1,VNUM:1,ErV:1,ErCt:1,M2PM1:2,M2Pr:2,M22:2,M23:2,M2Cp:2,M3Pr:3,M3B:3,M3TLU:3,M3G:3,M3KP:3,M3KPC:3,M4ZO:4,M4ZL:4,M4SS:4,AKL:5,AGR:5,AGR1:5,STUR:5,STUR1:5,PRkol:31,PRH:31,PRA:31,PRK1:31,PRK2:31,PRK3:31,PRP1:31,PRP2:31,PRP3:31,PLG:32,PLP1:32,PLP2:32,PLP3:32};
const cardMaketNames={1:'Условия участка',2:'Хозяйственные мероприятия',3:'Лесорастительная характеристика',4:'Захламлённость и сухостой',5:'Возраст и запас',31:'Подрост',32:'Подлесок'};
function referenceUsage(name){return [...new Set(sources().filter(x=>x.table===name).map(x=>{
 const form=canonical(x.form),caption=dict.fields[form]?.[x.field];if(!caption)return null;
 const n=cardMakets[x.field];
 if(form==='ВыделВ')return (n?'Макет '+n+' — '+cardMaketNames[n]:'Карточка таксации')+' · '+caption;
 if(/^Макет\d+$/.test(form))return form.replace('Макет','Макет ')+' — '+dict.formNames[form]+' · '+caption;
 return (form==='Квартал'?'Квартал':form==='Лесничество'?'Лесничество':null)?.concat(' · ',caption);
 }).filter(Boolean))];}
function referenceRows(name,rows,q,host){const spec=specForTable(name);let count=0;function more(){const slice=rows.slice(count,count+60);count+=slice.length;host.insertAdjacentHTML('beforeend',slice.map(row=>{const nameValue=member(row,spec.label||''),code=member(row,spec.code||'');const primary=nameValue!=null&&clean(nameValue)!==''?text(nameValue):'Без наименования';const known=Object.entries(row).filter(([k,v])=>v!=null&&v!==''&&columnTitles[k]&&!/код/i.test(columnTitles[k])&&k!==spec.code&&k!==spec.label);return '<article class="human-ref-row"><div><b>'+h(primary)+'</b>'+(code!=null?'<small>Шифр '+h(code)+'</small>':'')+'</div>'+(known.length?'<dl>'+known.map(([k,v])=>'<div><dt>'+h(columnTitles[k])+'</dt><dd>'+h(text(v))+'</dd></div>').join('')+'</dl>':'')+'</article>';}).join(''));host.querySelector('.refMore')?.remove();if(count<rows.length){const b=document.createElement('button');b.className='refMore';b.textContent='Показать ещё '+Math.min(60,rows.length-count);b.onclick=more;host.append(b);}}more();}
function refs(q=''){const box=document.querySelector('#friendlyRefs');if(!box)return;const tables=window.SOLIN_REFS?.tables;if(!tables){box.innerHTML='<p class="wf-muted">Справочники загружаются…</p>';return;}q=clean(q).toLowerCase();box.innerHTML='';let matched=0;
 for(const [name,table] of Object.entries(tables).sort(([a],[b])=>tableTitle(a).localeCompare(tableTitle(b),'ru'))){
 if(!referenceTitles[name])continue;
 const title=tableTitle(name),usage=referenceUsage(name),spec=specForTable(name);
 if(!spec.code||!spec.label)continue;
 const whole=(title+' '+usage.join(' ')).toLowerCase().includes(q),rows=!q||whole?table:table.filter(r=>[member(r,spec.label),member(r,spec.code)].some(v=>String(v??'').toLowerCase().includes(q)));if(!rows.length)continue;matched++;
 const d=document.createElement('details');d.className='refCard';d.dataset.reference=name;d.innerHTML='<summary><span><b>'+h(title)+'</b><small>'+rows.length+' значений</small></span><span aria-hidden="true">⌄</span></summary>';
 d.addEventListener('toggle',()=>{if(d.open&&!d.querySelector('.human-ref-list')){const host=document.createElement('div');host.className='human-ref-list';if(usage.length)host.innerHTML='<div class="human-ref-usage"><b>Где используется</b>'+usage.map(x=>'<p>'+h(x)+'</p>').join('')+'</div>';d.append(host);referenceRows(name,rows,q,host);}});box.append(d);}
 if(!matched)box.innerHTML='<div class="empty">Значения не найдены. Попробуйте название, макет или шифр.</div>';
}
function arrange(){const menu=document.querySelector('#menuScreen .workspace');if(menu){let details=menu.querySelector('#humanSupport');if(!details){details=document.createElement('details');details.id='humanSupport';details.className='human-source';details.innerHTML='<summary>Техническая информация и история</summary>';menu.append(details);}for(const button of Array.from(menu.querySelectorAll(':scope > .menuRow'))){if(/Каталог|611 выражений|Журнал|554 форм|Лесовладелец и лесничество/.test(button.textContent))details.append(button);}}
 const rs=document.querySelector('#refsScreen input');if(rs){rs.placeholder='Название, макет или шифр…';rs.oninput=e=>refs(e.target.value);}const p=document.querySelector('#refsScreen .screenHead p');if(p)p.textContent='Названия, шифры и макеты, в которых они используются.';
}
function coverage(){const tables=window.SOLIN_REFS?.tables||{},schemas=database()?.transfSchema||{},bindings=sources().filter(x=>schemas[canonical(x.form)]?.includes(x.field)),unresolved=[];for(const [form,fields] of Object.entries(schemas))for(const field of fields)if(!['POS','LESN','KV','KGLF','VD'].includes(field)&&isTechnical(form,field))unresolved.push({form,field,reason:'Нет подтверждённой подписи привязанного поля в выбранных оригинальных формах'});return {source:dict.source,labels:Object.values(dict.fields).reduce((s,x)=>s+Object.keys(x).length,0),referenceTables:Object.keys(tables).length,namedReferenceTables:Object.keys(tables).filter(k=>referenceTitles[k]).length,bindings:bindings.length,unresolved,limitations:['Динамические фильтры списков Access не исполняются','Неоднозначные значения не выбираются автоматически','Названия скрытых служебных полей не придуманы']};}
window.SolinHuman={label,value,lookup,input,codeLabel,isTechnical,formName:m=>dict.formNames[m]||m,text,refs,coverage,tableTitle};
window.renderFriendlyRefs=refs;
window.addEventListener('solin-refs-ready',()=>{cache.clear();refs(document.querySelector('#refsScreen input')?.value||'');arrange();});
window.addEventListener('solin-ready',()=>{arrange();window.renderFriendlyRefs=refs;});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arrange,{once:true});else arrange();
})();
