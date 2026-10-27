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
const NAMES={Макет10:'Таксационная характеристика · древостой',Макет11:'Лесные культуры',Макет12:'Повреждения насаждений',Макет13:'Земли линейного протяжения',Макет14:'Распределение угодий',Макет15:'Выполненные мероприятия',Макет16:'Растительность',Макет17:'Сельскохозяйственные угодья',Макет19:'Болота',Макет20:'Потери древесины',Макет21:'Ландшафтная характеристика',Макет23:'Особенности выдела',Макет25:'Плантации и древесные школы',Макет27:'Прежняя категория угодий',Макет28:'Транспортная доступность'};
const LABELS={
IAR:'Ярус',KOEF:'Коэффициент состава',POR:'Порода',LET:'Возраст, лет',PH:'Средняя высота, м',PD2:'Диаметр, см',KT:'Класс товарности',PROI:'Происхождение',POL:'Полнота',SPS:'Сумма площадей сечений',ZAP:'Запас, м³/га',
GC:'Год создания',COP:'Способ обработки почвы',CCZ:'Схема смешения',RMR:'Мероприятие',RVR:'Вид работ',KOL:'Количество',CLK:'Класс культуры',PG:'Показатель',
KTP:'Тип повреждения',GP:'Год повреждения',PORP:'Повреждённая порода',VV:'Вид вредителя',SV:'Степень вреда',VB:'Вид болезни',SB:'Степень болезни',
SHT:'Ширина',PRT:'Протяжённость',SOST:'Состояние',NAZ:'Назначение',TP:'Тип',SHR:'Ширина, м',SEZ:'Сезон',TM:'Характеристика',
KU:'Категория угодий',VTR1:'Вид 1',PTR1:'Доля 1',VTR2:'Вид 2',PTR2:'Доля 2',VTR3:'Вид 3',PTR3:'Доля 3',VTR4:'Вид 4',PTR4:'Доля 4',
KMP:'Вид мероприятия',G15:'Год',P15:'Порода',VZ:'Возраст',AV:'Площадь',OC:'Оценка',PNV:'Наличие',PL15:'Площадь, га',
Por16:'Порода',Koef16:'Коэффициент',Voz16:'Возраст',H16:'Высота',Neds:'Недревесный ресурс',Ediz:'Единица измерения',Ur16:'Урожайность',Sbor:'Сбор',
PL:'Площадь, га',TSP:'Тип сенокоса/пастбища',CSP:'Состояние',P17:'Порода',PR:'Процент',UR:'Урожайность',
TB:'Тип болота',TR:'Тип растительности',MTC:'Мощность торфа',ZP:'Зарастание: порода',ZPR:'Зарастание, %',
KP:'Категория потерь',MBD:'Вид древесины',P20:'Порода',ZO:'Объём',LIK:'Ликвидная древесина',DEL:'Деловая древесина',PLP:'Площадь',
TL:'Тип ландшафта',OES:'Эстетическая оценка',ORE:'Рекреационная оценка',UST:'Устойчивость',STP:'Степень',SPR:'Санитарное состояние',SD:'Доступность',MAF:'Малые архитектурные формы',
K1:'Особенность 1',K2:'Особенность 2',K3:'Особенность 3',K4:'Особенность 4',K5:'Особенность 5',K6:'Особенность 6',K7:'Особенность 7',K8:'Особенность 8',
GZ:'Год закладки',KLD:'Количество',KU_St:'Прежняя категория угодий',PD:'Тип дороги',TTR:'Тип транспорта',RAS:'Расстояние'
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
function localPatch(r){const data=read()[rowKey(r)];if(!data)return;Object.assign(r,data.base||{});r._children=r._children||{};for(const [m,rows] of Object.entries(data.makets||{}))r._children[m]=rows.map(v=>({...v}));}
function apply(){const database=db();if(!database?.quarters)return;for(const q of Object.values(database.quarters))for(const r of q.compartments||[])localPatch(r);}
let currentMaket='Макет10',activeMakEdit=null;
function findLookups(field,form){
 const exact=window.SolinHuman?.lookup(form,field);if(exact)return exact;
 if(form&&db()?.scopedLookups?.[form]?.[field])return db().scopedLookups[form][field];
 const database=db();let mapping={POR:'POR',P15:'POR',PORP:'POR',M3Pr:'POR',PRP1:'POR',KU:'KU',KU_St:'KU',TB:'TB',TR:'TR',IAR:'IAR',M3B:'M3B',M2PM1:'M2PM1'}[field];
 return mapping?database?.fieldLookups?.[mapping]:null;
}
function fieldInput(name,value='',prefix='wf',form='ВыделВ'){
 if(window.SolinHuman?.input)return SolinHuman.input(name,value,prefix,form);
 const label=window.SolinHuman?.label(form,name)||LABELS[name]||FORM_LABELS[name]||db()?.fieldLabels?.[name]||name;
 const id=prefix+'_'+name,lookup=findLookups(name,form),str=String(value??'');
 if(lookup){
 const options=Object.entries(lookup).filter(([k,v])=>k!==''&&v!=null).map(([k,v])=>'<option value="'+h(k)+'"'+(String(k)===str?' selected':'')+'>'+h(v)+'</option>').join('');
 return '<label class="wf-field"><span>'+h(label)+' <small>'+h('')+'</small></span><select id="'+h(id)+'" data-wffield="'+h(name)+'"><option value="">— не указано —</option>'+options+'</select></label>';
 }
 const numeric=DECIMAL.has(name)||['LET','VNUM','PRA','PRkol','KOEF','PH','PD2','ZAP','POL','MTC','G15','GZ'].includes(name);
 return '<label class="wf-field"><span>'+h(label)+' <small>'+h('')+'</small></span><input id="'+h(id)+'" data-wffield="'+h(name)+'" '+(numeric?'inputmode="decimal"':'')+' autocomplete="off" value="'+h(str)+'" placeholder="—"></label>';
}
function humanInputs(fields,values,prefix,form){const isTech=f=>window.SolinHuman?.isTechnical(form,f);const main=fields.filter(f=>!isTech(f)).map(f=>fieldInput(f,values[f]??'',prefix,form)).join('');const technical=fields.filter(isTech).map(f=>fieldInput(f,values[f]??'',prefix,form)).join('');return main+(technical?'<details class="human-technical"><summary>Служебные поля · значения сохранены</summary><div class="formGrid">'+technical+'</div></details>':'');}
function bindInputs(root,schema,prefix,values){const obj={};for(const key of schema){const el=root.querySelector('#'+prefix+'_'+key);if(!el)continue;const raw=el.value.trim();if(raw===''){obj[key]=null;continue;}
if((DECIMAL.has(key)||['LET','VNUM','PRA','PRkol','MTC','G15','GZ','PH','PD2','ZAP','POL'].includes(key))&&!Number.isFinite(Number(raw.replace(',','.'))))throw Error('Проверь число: '+(LABELS[key]||key));
obj[key]=DECIMAL.has(key)||['LET','VNUM','PRA','PRkol','MTC','G15','GZ','PH','PD2','ZAP','POL'].includes(key)?Number(raw.replace(',','.')):raw;
}return obj;}
function maketsOf(r){return r?Object.keys(r._children||{}):[];}
function rowsOf(r,m){const rows=r?._children?.[m];return Array.isArray(rows)?rows:[];}
function maketSummary(r,m){const rows=rowsOf(r,m),length=rows.length;
 if(m==='Макет10'&&length){const summed=rows.reduce((s,v)=>s+(Number(v.ZAP)||0),0);return length+' записей · Σ ZAP '+summed.toLocaleString('ru-RU')+' (справочно)';}
 return length?length+' записей':'Нет данных';
}
function cardToolbar(){const host=document.querySelector('#childTabs');if(!host||!record())return;
const tabs='<div class="wf-maket-head"><div><b>Характеристики выдела</b><small>Данные и полевые наблюдения</small></div><button type="button" class="wf-action" id="wfShowComplete">Все разделы</button></div>'+
'<div class="wf-maket-nav">'+CORE.map(m=>'<button type="button" class="wf-makbtn '+(currentMaket===m?'on':'')+'" data-maket="'+m+'"><b>'+h(window.SolinHuman?.formName(m)||NAMES[m])+'</b><i>'+rowsOf(record(),m).length+'</i></button>').join('')+'</div>';
host.innerHTML=tabs;host.querySelectorAll('[data-maket]').forEach(b=>b.onclick=()=>openMaket(b.dataset.maket));
host.querySelector('#wfShowComplete').onclick=showWholeCard;
const oldBar=document.querySelector('#humanContent .solinEditBar');
if(oldBar)oldBar.style.display='none';
const content=document.querySelector('#humanContent');
if(content&&!content.querySelector('#wfCardActions')){
const bar=document.createElement('div');bar.id='wfCardActions';bar.className='wf-toolbar';
bar.innerHTML='<button class="wf-primary" id="wfEditBase">✎ Редактировать выдел</button><button id="wfCardCheck">✓ Контроль</button><button id="wfCardPrint">⎙ Печать КТ</button><button id="wfCardExit">↩ Выход</button>';
content.prepend(bar);
bar.querySelector('#wfEditBase').onclick=editBase;bar.querySelector('#wfCardCheck').onclick=()=>SolinControlUI.open({records:[record()],caption:'Карточка · квартал '+record().KV+' · выдел '+record().VD});
bar.querySelector('#wfCardPrint').onclick=printCard;bar.querySelector('#wfCardExit').onclick=exitCard;
}}
function showWholeCard(){const r=record();if(!r)return;document.querySelector('#childContent').innerHTML='<div class="wf-maket-view"><h3>Краткая карточка таксации · КТ</h3><p class="wf-muted">Аналог сводного просмотра ВыделКрат. Данные отображаются без расчёта исходных Access-отчётов.</p>'+CORE.map(m=>'<div class="wf-summary-row"><b>'+m.replace('Макет','')+' · '+h(window.SolinHuman?.formName(m)||NAMES[m])+'</b><span>'+h(maketSummary(r,m))+'</span><button data-cardmak="'+m+'">Открыть →</button></div>').join('')+'</div>';
document.querySelectorAll('[data-cardmak]').forEach(b=>b.onclick=()=>openMaket(b.dataset.cardmak));}
function openMaket(m){const r=record();if(!r||!CORE.includes(m))return;currentMaket=m;cardToolbar();
const rs=rowsOf(r,m),fields=(db()?.transfSchema?.[m]||[]).filter(n=>!KEY_FIELDS.includes(n));
const wrap=document.querySelector('#childContent');if(!wrap)return;
let html='<div class="wf-maket-view"><div class="wf-section-head"><div><div class="wf-eyebrow">'+rs.length+' записей</div><h3>'+h(window.SolinHuman?.formName(m)||NAMES[m])+'</h3></div><button class="wf-primary" id="wfAddRow">＋ Строка</button></div>';
html+='<p class="wf-muted">Выберите запись для изменения или добавьте новую.</p>';
if(!rs.length)html+='<div class="wf-empty">Здесь пока нет записей. Добавьте первую.</div>';
rs.forEach((row,i)=>{
 const renderValue=k=>row[k]!==null&&row[k]!==undefined&&row[k]!==''?'<div class="wf-kv"><span>'+h(window.SolinHuman?.label(m,k)||LABELS[k]||FORM_LABELS[k]||k)+'</span><b>'+h(window.SolinHuman?SolinHuman.value(m,k,row[k],row):findLookups(k,m)?.[String(row[k])]||fmt(row[k]))+'</b></div>':'';const values=fields.filter(k=>!window.SolinHuman?.isTechnical(m,k)).map(renderValue).filter(Boolean).join('');const raw=fields.filter(k=>window.SolinHuman?.isTechnical(m,k)).map(renderValue).filter(Boolean).join('');
 html+='<article class="wf-row"><div class="wf-rowhead"><b>Запись '+(i+1)+'</b><span><button data-edit="'+i+'">Изменить</button><button class="wf-danger" data-del="'+i+'">Удалить</button></span></div><div class="wf-grid">'+(values||'<div class="wf-muted">Запись без заполненных полей</div>')+(raw?'<details class="human-source"><summary>Служебные данные</summary>'+raw+'</details>':'')+'</div></article>';
});
html+='</div>';wrap.innerHTML=html;
wrap.querySelector('#wfAddRow').onclick=()=>editMaket(m,rs.length);
wrap.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editMaket(m,Number(b.dataset.edit)));
wrap.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>deleteMaket(m,Number(b.dataset.del)));
}
function editMaket(m,index){const r=record();if(!r)return;
const fields=(db()?.transfSchema?.[m]||[]).filter(n=>!KEY_FIELDS.includes(n)),existing=rowsOf(r,m)[index]||{};
if(typeof openModal!=='function')return;
openModal((index===rowsOf(r,m).length?'Новая запись · ':'Изменение · ')+(window.SolinHuman?.formName(m)||NAMES[m]),
'<div class="wf-form-note">Данные сохраняются только в SOLI-N Field. Оригинальные базы SOLI-N не изменяются.</div><div class="formGrid wf-formgrid">'+humanInputs(fields,existing,'wf',m)+'</div><div class="formActions"><button class="secondary" onclick="closeModal()">Отмена</button><button class="primary" id="wfSaveMaket">Сохранить</button></div>');
document.querySelector('#wfSaveMaket').onclick=()=>{const container=document.querySelector('#modalBody');let values;try{values=bindInputs(container,fields,'wf',existing);}catch(e){notify(e.message);return;}
const before=JSON.stringify(r);const failures=window.solinCore?.validateRow(m,values,r)||[];if(failures.length){notify(failures.join("; "));return;}const target=(r._children=r._children||{});
const list=[...rowsOf(r,m)],base={...existing,...values};
for(const k of KEY_FIELDS)base[k]=r[k]??null;
if(index>=list.length)list.push(base);else list[index]=base;
target[m]=list;
try{saveAll(r);}catch(e){Object.assign(r,JSON.parse(before));notify('Не удалось сохранить: '+e.message);return;}
closeModal();openMaket(m);notify('Сохранено: '+m);
};}
function saveAll(r){const makets={};for(const m of CORE){const list=rowsOf(r,m);makets[m]=list.map(row=>({...row}));}store(r,{makets,base:Object.fromEntries(EDIT_FIELDS.map(k=>[k,r[k]??null]))});}
function deleteMaket(m,index){const r=record();if(!r)return;
if(!confirm('Удалить только эту запись '+m+' №'+(index+1)+' из локальной мобильной копии?'))return;
const before=JSON.stringify(r);r._children[m]=rowsOf(r,m).filter((_,i)=>i!==index);
try{saveAll(r);openMaket(m);notify('Запись удалена локально');}catch(e){Object.assign(r,JSON.parse(before));notify(e.message);}}
function editBase(){const r=record();if(!r)return;
if(window.SolinCardEditor)return window.SolinCardEditor.open(r);
openModal('Выдел '+r.VD+' · квартал '+r.KV,'<div class="wf-form-note">Редактирование основной таблицы «Выдел»; состав макетов редактируется в отдельных разделах.</div><div class="formGrid wf-formgrid">'+humanInputs(EDIT_FIELDS,r,'wfb','ВыделВ')+'</div><div class="formActions"><button class="secondary" onclick="closeModal()">Отмена</button><button class="primary" id="wfSaveBase">Сохранить выдел</button></div>');
document.querySelector('#wfSaveBase').onclick=()=>{
 let fields;try{fields=bindInputs(document.querySelector('#modalBody'),EDIT_FIELDS,'wfb',r);}catch(e){notify(e.message);return;}
 const p=Number(String(fields.PLV).replace(',','.'));if(!Number.isFinite(p)||p<=0){notify('Площадь выдела должна быть положительной');return;}
 const failed=(window.solinCore?.validateRow('ВыделВ',fields,r)||[]).filter(msg=>{const field=msg.split(':')[0];return String(fields[field]??'')!==String(r[field]??'')});if(failed.length){notify(failed.join('; '));return;}const before=JSON.stringify(r);Object.assign(r,fields,{PLV:p});try{saveAll(r);}catch(e){Object.assign(r,JSON.parse(before));notify(e.message);return;}
 closeModal();if(typeof renderComp==='function')renderComp();if(typeof refresh==='function')refresh();notify('Поля выдела сохранены');
};}
function exitCard(){const r=record();if(!r)return;const m=rowsOf(r,'Макет10')[0];
if(m?.ZAP!==null&&m?.ZAP!==undefined&&m?.ZAP!==''){r.STUR1=m.ZAP;try{saveAll(r);}catch(e){notify('Не сохранилось: '+e.message);return;}}
if(typeof show==='function')show('quartersScreen');}
function checkData(r,modal){if(!r)return;const msgs=[];
const area=Number(r.PLV);if(!(area>0))msgs.push({status:'bad',message:'Площадь PLV не задана или не положительна'});
if(r.KU===null||r.KU===undefined||r.KU==='')msgs.push({status:'bad',message:'Не указана категория угодий KU'});
const seen=new Map();for(const m of CORE){for(const [i,row]of rowsOf(r,m).entries()){
 if(m==='Макет10'){const age=Number(row.LET),h=Number(row.PH),p=Number(row.POL);if(row.LET!=null&&row.LET!==''&&age<0)msgs.push({status:'bad',message:m+' строка '+(i+1)+': возраст меньше нуля'});if(row.PH!=null&&row.PH!==''&&h<0)msgs.push({status:'bad',message:m+' строка '+(i+1)+': высота отрицательная'});if(row.POL!=null&&row.POL!==''&&(p<0||p>1))msgs.push({status:'warn',message:m+' строка '+(i+1)+': полнота вне обычного диапазона 0–1 (проверь шкалу)'});}
 if(m==='Макет23'){for(let k=1;k<=8;k++){const v=row['K'+k];if(v!==''&&v!==null&&v!==undefined){seen.set(String(v), (seen.get(String(v))||0)+1)}}}
 }}
 for(const [code,count]of seen)if(count>1)msgs.push({status:'warn',message:'Макет 23: код особенности '+code+' встречается '+count+' раза'});
 const total=rowsOf(r,'Макет10').reduce((sum,row)=>sum+(Number(row.ZAP)||0),0);
 const html='<div class="wf-form-note">Локальная предварительная проверка, не замена 142 контрольных форм оригинальной SOLI-N.</div><p><b>Найдено замечаний:</b> '+msgs.length+'</p>'+msgs.map(x=>'<div class="wf-check '+x.status+'">'+h(x.message)+'</div>').join('')+(msgs.length===0?'<div class="wf-check ok">По базовым правилам ошибок не обнаружено.</div>':'')+'<div class="wf-form-note">Σ ZAP по Макету 10: <b>'+h(total.toLocaleString('ru-RU'))+'</b> (только информационная сумма, не общий расчёт исходной системы).</div><button class="primary" onclick="closeModal()">Закрыть</button>';
if(modal)openModal('Контроль выдела '+r.KV+'-'+r.VD,html);
return msgs;}
function printCard(){const r=record();if(!r)return;let html='<h1>Карточка таксации SOLI-N Field</h1><p>Лесничество: '+h(db()?.source?.forestDistrict||'')+'</p><p><b>Квартал '+h(r.KV)+' · Выдел '+h(r.VD)+'</b> · Площадь '+h(r.PLV)+' га</p>';
html+='<h2>Основные сведения</h2><table>'+EDIT_FIELDS.filter(k=>r[k]!=null&&r[k]!=='').map(k=>'<tr><th>'+h(window.SolinHuman?.label('ВыделВ',k)||FORM_LABELS[k]||k)+'</th><td>'+h(r[k])+'</td></tr>').join('')+'</table>';
for(const m of CORE){const rows=rowsOf(r,m);if(!rows.length)continue;html+='<h2>'+h(m)+' · '+h(window.SolinHuman?.formName(m)||NAMES[m])+'</h2>';rows.forEach((row,i)=>{html+='<h3>Запись '+(i+1)+'</h3><table>'+Object.entries(row).filter(([k,v])=>!KEY_FIELDS.includes(k)&&v!==null&&v!==undefined&&v!=='').map(([k,v])=>'<tr><th>'+h(window.SolinHuman?.label(m,k)||LABELS[k]||k)+'</th><td>'+h(v)+'</td></tr>').join('')+'</table>';});}
const win=window.open('','_blank');if(!win){notify('Разреши открытие нового окна для печати');return;}
win.document.write('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Таксационная карточка</title><style>body{font:14px Arial;padding:20px;color:#17251d}table{border-collapse:collapse;width:100%;margin-bottom:10px}th,td{border:1px solid #b7c9ba;padding:6px;text-align:left}th{width:44%;background:#eef5ec}h2{border-bottom:1px solid #b4cab5;padding:8px 0}h3{font-size:14px}@media print{button{display:none}}</style><button onclick="print()">Печать</button>'+html+'<p><small>Предварительная мобильная карточка, не официальный отчёт Access.</small></p></html>');
win.document.close();}
function quarterToolbar(k){const box=document.querySelector('#quarters');if(!box||!db()?.quarters?.[k])return;const old=box.querySelector('#wfQuarterToolbar');old?.remove();const q=db().quarters[k],bar=document.createElement('div');bar.id='wfQuarterToolbar';bar.className='wf-toolbar';
bar.innerHTML='<button id="wfQuarterControl">✓ Контроль квартала</button><button id="wfQuarterSummary">▤ Такс. описание</button><button id="wfQuarterExport">⇩ Сохранить JSON квартала</button>';
box.querySelector('.screenHead')?.after(bar);
bar.querySelector('#wfQuarterControl').onclick=()=>{if(window.SolinControlUI)return SolinControlUI.open({records:q.compartments||[],caption:'Квартал '+k});let issues=0;const entries=[];for(const r of q.compartments||[]){const list=checkData(r,false);issues+=list.length;if(list.length)entries.push(r.VD+': '+list.length+' замечаний');}
openModal('Квартал '+k+' · контроль','<div class="wf-form-note">Предварительная проверка без выполнения контролей Access.</div><p>Выделов: '+q.compartments.length+'</p><p>Замечаний: <b>'+issues+'</b></p>'+entries.map(x=>'<p>'+h(x)+'</p>').join('')+'<button class="primary" onclick="closeModal()">Закрыть</button>');};
bar.querySelector('#wfQuarterSummary').onclick=()=>{const area=q.compartments.reduce((s,r)=>s+(Number(r.PLV)||0),0);openModal('Таксационное описание · квартал '+k,'<h3>Квартал '+h(k)+'</h3><p>Выделов: '+q.compartments.length+'</p><p>Площадь: '+area.toLocaleString('ru-RU')+' га</p><div class="wf-form-note">Это сводка из мобильных данных, а не официальный выходной документ SOLI-N.</div><button class="primary" onclick="closeModal()">Закрыть</button>');};
bar.querySelector('#wfQuarterExport').onclick=()=>download('solin-quarter-'+k+'.json',{format:'SOLIN-Field-Quarter-v1',quarter:k,records:q.compartments});}
function download(name,payload){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function setup(){

 const prev=window.renderComp;
 if(typeof prev==='function')window.renderComp=function(){if(record())localPatch(record());prev();currentMaket='Макет10';cardToolbar();openMaket(currentMaket);};
 const oldQuarter=window.openQuarter;
 if(typeof oldQuarter==='function')window.openQuarter=function(k){oldQuarter(k);quarterToolbar(k);};
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
