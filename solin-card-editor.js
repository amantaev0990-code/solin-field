/* Taxation card editor. Makets 1–5, 31 and 32 belong to the stand row.
 * Address fields stay fixed; quarter metadata is scoped by the full address.
 * All editing uses a draft until the single Save action succeeds. */
(()=>{'use strict';
const keys=['POS','LESN','KV','KGLF','VD'];
const sections=[
 ['1','Условия участка',['OZU','CkEk','CkKr','VNUM','ErV','ErCt']],
 ['2','Хозяйственные мероприятия',['M2PM1','M2Pr','M22','M23','M2Cp']],
 ['3','Лесорастительная характеристика',['M3Pr','M3B','M3TLU','M3G','M3KP','M3KPC']],
 ['4','Захламлённость и сухостой',['M4ZO','M4ZL','M4SS']],
 ['5','Возраст и запас',['AKL','AGR','AGR1','STUR','STUR1']],
 ['31','Подрост',['PRkol','PRH','PRA','PRK1','PRP1','PRK2','PRP2','PRK3','PRP3']],
 ['32','Подлесок',['PLG','PLP1','PLP2','PLP3']]
];
const extras=[11,12,13,14,15,16,17,19,20,21,23,25,27,28];
// Desktop SOLI-N uses the complete forestry + quarter/category address.
// Repeated quarter rows may differ in хозяйственная секция and functional zone.
function quarterForRecord(record){
 const q=D.quarters?.[String(record.KV)];
 if(!q)return null;
 const rows=q.quarterRows?.length?q.quarterRows:[q.meta||{}];
 const candidates=rows.filter(row=>['POS','LESN','KV','KGLF'].every(k=>
   row[k]==null ? rows.length===1 : same(row[k],record[k])));
 const detailed=candidates.filter(row=>
   same(row.Klxr,record.KlxrVD)&&same(row.Fzona,record.Fzona));
 return detailed.length===1?detailed[0]:candidates.length===1?candidates[0]:null;
}
const numeric=new Set(['PLV','GodT','CkKr','VNUM','M2Pr','M3G','M3KP','M3KPC','M4ZO','M4ZL','M4SS','AKL','AGR','AGR1','STUR','STUR1','PRkol','PRH','PRA','PRK1','PRK2','PRK3','KOEF','LET','PH','PD2','KT','POL','SPS','ZAP','RAS','Koef16','Voz16','H16','Ur16','Sbor','VZ','SHR','PRT','SHT','KLD','PR','PL','PL15','PTR1','PTR2','PTR3','PTR4','ZPR','STUR1','KOL','AV','ZO','LIK','DEL','PLP','MTC','G15','GZ']);
numeric.add('VD');
numeric.add('IAR'); // Original SIAR/PIAP link uses numeric KIAR; preserve numeric MDB column type.
const aliases={PRkol:'Количество, тыс. шт.',PRH:'Средняя высота, м',PRA:'Средний возраст, лет',PRK1:'Коэффициент 1',PRK2:'Коэффициент 2',PRK3:'Коэффициент 3',PRP1:'Порода 1',PRP2:'Порода 2',PRP3:'Порода 3',PLP1:'Порода 1',PLP2:'Порода 2',PLP3:'Порода 3',PLG:'Густота',AGR1:'Группа возраста ТО',M2Pr:'Процент выборки, %'};
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=v=>JSON.parse(JSON.stringify(v));
const same=(a,b)=>String(a??'')===String(b??'');
let session=null,previousFocus=null,previousOverflow='';
const title=(form,f)=>aliases[f]||SolinHuman.label(form,f);
const DESKTOP_WIDTH=1200,DESKTOP_HEIGHT=704;
const desktopLabels={IAR:'Ярус',KOEF:'Коэфф.',POR:'Порода',LET:'А, лет',PH:'Н, м',PD2:'Д, см',KT:'Класс',PROI:'Происхождение',POL:'Полнота',SPS:'Сумма',ZAP:'Запас'};
function input(form,field,value,scope,index){
 const id='ce_'+scope+'_'+(index??'base')+'_'+field,fragment=document.createElement('div');
 const shown=numeric.has(field)&&typeof value==='number'?value.toLocaleString('ru-RU',{useGrouping:false,maximumFractionDigits:6}):value;
 fragment.innerHTML=SolinHuman.input(field,shown??'',id,form);
 const label=fragment.firstElementChild,el=label.querySelector('input,select');
 const caption=SolinHuman.isTechnical(form,field)?D.fieldLabels?.[field]||field:title(form,field);
 label.className='ce-field';label.querySelector('span').textContent=caption;
 el.id=id;el.dataset.ceField=field;el.dataset.ceScope=scope;el.dataset.ceForm=form;
 el.setAttribute('aria-label',caption);el.removeAttribute('data-wffield');
 if(index!=null)el.dataset.ceRow=index;
 if(el.tagName==='SELECT')for(const option of el.options){
   const description=option.textContent.trim();
   option.title=description;
   // In original Access the expanded list shows a code *and* its meaning.
   // Leave the actual option.value unchanged for Transfer/MDB compatibility.
   option.textContent=option.value
      ? option.value+(description&&description!==option.value?' — '+description:'')
      : '—';
 }
 else{el.placeholder=numeric.has(field)?'0':'';if(numeric.has(field))el.inputMode='decimal';}
 return label.outerHTML;
}
function fields(form,names,values,scope){return names.map(f=>cell(f,values[f],scope,form,{label:SolinHuman.isTechnical(form,f)?D.fieldLabels?.[f]||f:title(form,f),split:!!SolinHuman.lookup(form,f)})).join('');}
function description(form,field,value){if(value==null||value==='')return '';const text=SolinHuman.value(form,field,value,session?.draft);return /^Неизвестное значение/.test(text)?'':text;}
function cell(field,value,scope='base',form='ВыделВ',opts={}){const name=opts.label??title(form,field),id='ce_'+scope+'_base_'+field;
 return '<div class="dt-cell'+(opts.inline?' dt-inline':'')+(opts.split?' dt-split':'')+'" style="flex:'+h(opts.weight||1)+'" data-dt-cell="'+h(field)+'">'+(opts.label===false?'':'<label for="'+id+'">'+h(name)+'</label>')+'<div class="dt-input">'+input(form,field,value,scope)+(opts.split?'<output data-ce-display-for="'+id+'">'+h(description(form,field,value))+'</output>':'')+'</div></div>';
}
function fixed(label,value,width,opts={}){return '<div class="dt-fixed'+(opts.inline?' dt-inline':'')+'"'+(width?' style="width:'+width+'px"':'')+'>'+(label?'<span>'+h(label)+'</span>':'')+'<input readonly aria-label="'+h(label||opts.aria||'')+'" value="'+h(value??'')+'"'+(opts.unavailable?' title="Поле пока недоступно для редактирования"':'')+'></div>';}
function maket(n,body){return '<section class="dt-section" id="ce-section-'+n+'" aria-label="Макет '+n+'"><b class="dt-maket">'+(n==='31'?'Подрост<br>':n==='32'?'Подлесок<br>':'')+'Макет '+n+'</b><div class="dt-fields">'+body+'</div></section>';}
function block(number,name,body){return '<section class="dt-section" id="ce-section-'+number+'" aria-label="Макет '+number+'">'+body+'</section>';}
function newTableRow(form){return Object.fromEntries((D.transfSchema[form]||[]).map(f=>[f,keys.includes(f)?session.draft[f]??null:numeric.has(f)?0:form==='Макет10'&&f==='IAR'?Number(window.SolinDependentRules?.allowedLayers(session.draft,window.SOLIN_REFS?.tables)?.items?.[0]?.value??0)||null:form==='Макет10'&&f==='PROI'?0:null]));}
function table(form){const rs=session.draft._children[form]||[],schema=(D.transfSchema[form]||[]).filter(f=>!keys.includes(f)),shown=rs.length?rs:[newTableRow(form)];
 const m10=form==='Макет10';
 return '<div class="ce-table-wrap" tabindex="0" aria-label="Таблица '+h(form)+'"><table class="ce-table"><caption class="ce-sr-only">'+h(form)+' — '+h(SolinHuman.formName(form))+'</caption><colgroup><col style="width:24px">'+schema.map(f=>'<col'+(m10?' style="width:'+({IAR:145,KOEF:85,POR:190,LET:55,PH:55,PD2:55,KT:70,PROI:160,POL:80,SPS:75,ZAP:110}[f]||90)+'px"':'')+'>').join('')+'</colgroup><thead><tr><th scope="col"></th>'+schema.map(f=>'<th scope="col">'+h(m10?desktopLabels[f]:SolinHuman.label(form,f))+'</th>').join('')+'</tr></thead><tbody>'+shown.map((row,i)=>'<tr'+(!rs.length?' data-ce-placeholder="true"':'')+'><th scope="row" tabindex="0" data-ce-select="'+i+'" data-ce-select-form="'+h(form)+'" aria-label="Запись '+(i+1)+'">'+(i===0?'►':'')+'</th>'+schema.map(f=>'<td>'+input(form,f,row[f],form,i)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><div class="dt-record-nav"><span>Запись: </span><button type="button" data-ce-record="first" data-ce-table="'+form+'" aria-label="Первая запись">|◀</button><button type="button" data-ce-record="previous" data-ce-table="'+form+'" aria-label="Предыдущая запись">◀</button><span data-ce-count="'+form+'">'+(rs.length?'1 из '+rs.length:'Новая')+'</span><button type="button" data-ce-record="next" data-ce-table="'+form+'" aria-label="Следующая запись">▶</button><button type="button" data-ce-record="last" data-ce-table="'+form+'" aria-label="Последняя запись">▶|</button><button type="button" data-ce-add="'+form+'" aria-label="Добавить запись">▶*</button><button type="button" data-ce-delete="'+form+'" data-ce-index="0" aria-label="Удалить выбранную запись">×</button></div>';
}
function footer(){const routes=SOLIN_AUDIT.routes['ВыделВ']||[],buttons=routes.filter(x=>/^\d+$/.test(x.caption)).sort((a,b)=>Number(a.left)-Number(b.left));
 return '<footer class="dt-footer"><span class="dt-footer-label">Макет</span>'+buttons.map(b=>'<button type="button" data-ce-extra="Макет'+h(b.caption)+'" style="left:'+(Number(b.left)*.08)+'px;width:'+(Number(b.width)*.08)+'px" title="'+h(SolinHuman.formName('Макет'+b.caption))+'" aria-label="Макет '+b.caption+' — '+h(SolinHuman.formName('Макет'+b.caption))+'">'+b.caption+'</button>').join('')+'<select class="dt-maket-select" aria-label="Дополнительные макеты"><option value=""></option>'+[10,...extras,31,32].map(n=>'<option value="'+n+'">Макет '+n+'</option>').join('')+'</select><button type="button" class="dt-kt" data-ce-preview>КТ</button><button type="button" class="dt-print" data-ce-print>Печать</button><button type="button" class="dt-control" data-ce-controls="6">Конт. рубок</button><button type="button" class="dt-new" data-ce-new>Новая</button><button type="submit" class="dt-exit" id="ce-exit">Выход</button></footer>';
}
function markup(){const s=session,r=s.draft,o=D.lesnichestvo?.find(x=>same(x.POS,r.POS)&&same(x.LESN,r.LESN))||{},stands=D.quarters[r.KV]?.compartments.filter(x=>same(x.POS,r.POS)&&same(x.LESN,r.LESN)&&same(x.KGLF,r.KGLF))||[],known=new Set([...keys,'Fzona','PLV','KU','CR','KlxrVD',...sections.flatMap(x=>x[2])]),rest=(D.transfSchema['Выдел']||[]).filter(f=>!known.has(f));
 return '<form id="ce-form" novalidate><div class="dt-toolbar"><div class="dt-zoom-controls"><span>Масштаб</span><button type="button" data-ce-zoom="out" aria-label="Уменьшить">−</button><output id="ce-zoom">100%</output><button type="button" data-ce-zoom="in" aria-label="Увеличить">+</button><button type="button" data-ce-zoom="fit">По ширине</button><button type="button" data-ce-zoom="actual">100%</button></div><span class="dt-toolbar-spacer"></span><div class="dt-tools"><button type="button" data-ce-support>Поля…</button><button type="button" data-ce-makets>Макеты</button><button type="button" data-ce-controls="">Контроль</button><button type="submit" id="ce-save">Сохранить</button><button type="button" id="ce-cancel">Отмена</button><span id="ce-status" role="status">'+(s.isNew?'Новая':'')+'</span></div></div>'+
 '<div id="ce-calc-notice" class="ce-calc-notice" role="status" aria-live="polite" hidden></div>'+ 
 '<div class="dt-viewport" aria-label="Настольная карточка. Прокрутка по горизонтали и вертикали" tabindex="0"><div class="dt-stage"><div class="dt-board" data-desktop-width="1200"><div id="ce-main"><header class="dt-header"><div class="ce-summary"><h2>Карточка таксации</h2></div><div class="dt-counters"><span>Выделов всего;</span>'+fixed('',stands.length,42,{aria:'Выделов всего'})+'<span>последний</span>'+fixed('',stands.length?Math.max(...stands.map(x=>Number(x.VD)||0)):'',48,{aria:'Последний выдел'})+'</div><div class="dt-owner"><span>Лесовладелец</span>'+fixed('',r.POS,42,{aria:'Код лесовладельца'})+fixed('',o.NLX,520,{aria:'Лесовладелец'})+'<span>Лесничество</span>'+fixed('',r.LESN,40,{aria:'Номер лесничества'})+fixed('',o.NOS,304,{aria:'Лесничество'})+'</div><div class="dt-category"><span>Категория ГЛФ</span>'+fixed('',r.KGLF,42,{aria:'Категория ГЛФ, код'})+fixed('',description('ВыделВ','KGLF',r.KGLF),745,{aria:'Категория ГЛФ'})+cell('Fzona',r.Fzona,'base','ВыделВ',{label:'Функ. зона',inline:true,split:true})+'</div><div class="dt-quarter"><span>Квартал</span>'+fixed('',r.KV,38,{aria:'Квартал'})+cell('GodT',s.quarter.GodT,'quarter','Квартал',{label:'Год таксации',inline:true})+cell('Rel',s.quarter.Rel,'quarter','Квартал',{label:'Рельеф',inline:true,split:true})+cell('Dost',s.quarter.Dost,'quarter','Квартал',{label:'Доступность',inline:true,split:true})+cell('KlxrVD',r.KlxrVD,'base','ВыделВ',{label:false,split:true})+'</div></header>'+
 '<section class="dt-base" aria-label="Выдел и категория угодий">'+(s.isNew?cell('VD',r.VD,'base','ВыделВ',{label:'Выдел',weight:.45}):fixed('Выдел',r.VD,42))+cell('PLV',r.PLV,'base','ВыделВ',{label:'Площадь',weight:.65})+cell('KU',r.KU,'base','ВыделВ',{label:'Категория угодий',weight:3.2,split:true})+cell('CR',r.CR,'base','ВыделВ',{label:'Способ рубки',weight:1.9,split:true})+fixed('Памятник, заказник','',235,{unavailable:true})+fixed('Арендатор','',220,{unavailable:true})+'</section>'+
 '<div id="ce-category-guidance" class="ce-category-guidance" role="status" aria-live="polite">Допустимые ярусы будут показаны после выбора категории угодий.</div>'+ 
 maket('1',cell('OZU',r.OZU,'base','ВыделВ',{label:'Особозащитный участок',weight:3.2,split:true})+cell('CkEk',r.CkEk,'base','ВыделВ',{label:'Склон - экспозиция',weight:1.7,split:true})+cell('CkKr',r.CkKr,'base','ВыделВ',{label:'крутизна',weight:.65})+cell('VNUM',r.VNUM,'base','ВыделВ',{label:'ВНУМ',weight:.65})+cell('ErV',r.ErV,'base','ВыделВ',{label:'Эрозия - вид',weight:1.6,split:true})+cell('ErCt',r.ErCt,'base','ВыделВ',{label:'степень',weight:1.5,split:true}))+
 maket('2',cell('M2PM1',r.M2PM1,'base','ВыделВ',{label:'Первое мероприятие',weight:3.1,split:true})+cell('M2Pr',r.M2Pr,'base','ВыделВ',{label:'Процент',weight:.55})+cell('M22',r.M22,'base','ВыделВ',{label:'Второе мероприятие',weight:2.6,split:true})+cell('M23',r.M23,'base','ВыделВ',{label:'Третье мероприятие',weight:2.6,split:true})+cell('M2Cp',r.M2Cp,'base','ВыделВ',{label:'Целевая порода',weight:2.2,split:true}))+
 maket('3',cell('M3Pr',r.M3Pr,'base','ВыделВ',{label:'Главная порода',weight:3,split:true})+cell('M3B',r.M3B,'base','ВыделВ',{label:'Бонитет',weight:.6})+cell('M3TLU',r.M3TLU,'base','ВыделВ',{label:'Характеристика типа леса',weight:3.3,split:true})+cell('M3G',r.M3G,'base','ВыделВ',{label:'Год выруб.',weight:.75})+cell('M3KP',r.M3KP,'base','ВыделВ',{label:'Пней всего, шт.',weight:.9})+cell('M3KPC',r.M3KPC,'base','ВыделВ',{label:'в т.ч. хвойных',weight:.9}))+
 maket('4',cell('M4ZO',r.M4ZO,'base','ВыделВ',{label:'Захламленность общая, м3/га',inline:true,weight:3.5})+cell('M4ZL',r.M4ZL,'base','ВыделВ',{label:'Ликвид, м3/га',inline:true,weight:2.1})+cell('M4SS',r.M4SS,'base','ВыделВ',{label:'Сухостой, м3/га',inline:true,weight:2.1}))+
 maket('5',cell('AKL',r.AKL,'base','ВыделВ',{label:'Класс возраста',inline:true,weight:1.8})+cell('AGR',r.AGR,'base','ВыделВ',{label:'Группа возраста',inline:true,weight:1.8})+cell('AGR1',r.AGR1,'base','ВыделВ',{label:'Группа возр. ТО',inline:true,weight:1.9})+cell('STUR',r.STUR,'base','ВыделВ',{label:'Запас выдела',inline:true,weight:1.9})+fixed('в т.ч.3 или 5 яр.','',156,{inline:true,unavailable:true})+fixed('Ед. дер.','',112,{inline:true,unavailable:true})+fixed('Сухостой','',122,{inline:true,unavailable:true}))+
 '<section class="dt-stand" id="ce-section-10" aria-label="Макет 10"><b class="dt-stand-title">Макет 10</b><div id="ce-table-Макет10">'+table('Макет10')+'</div></section>'+
 maket('31',cell('PRkol',r.PRkol,'base','ВыделВ',{label:'К-во, тыс.шт.',weight:.65})+cell('PRH',r.PRH,'base','ВыделВ',{label:'Ср. выс.',weight:.6})+cell('PRA',r.PRA,'base','ВыделВ',{label:'Ср. возр.',weight:.6})+cell('PRK1',r.PRK1,'base','ВыделВ',{label:'коэфф. 1',weight:.55})+cell('PRP1',r.PRP1,'base','ВыделВ',{label:'1 порода',weight:2,split:true})+cell('PRK2',r.PRK2,'base','ВыделВ',{label:'коэфф. 2',weight:.55})+cell('PRP2',r.PRP2,'base','ВыделВ',{label:'2 порода',weight:2,split:true})+cell('PRK3',r.PRK3,'base','ВыделВ',{label:'коэфф. 3',weight:.55})+cell('PRP3',r.PRP3,'base','ВыделВ',{label:'3 порода',weight:2,split:true}))+
 maket('32',cell('PLG',r.PLG,'base','ВыделВ',{label:'Густота',weight:2,split:true})+cell('PLP1',r.PLP1,'base','ВыделВ',{label:'1 порода',weight:2.8,split:true})+cell('PLP2',r.PLP2,'base','ВыделВ',{label:'2 порода',weight:2.8,split:true})+cell('PLP3',r.PLP3,'base','ВыделВ',{label:'3 порода',weight:2.8,split:true}))+footer()+'</div><div id="ce-extra" hidden></div><div id="ce-action-panel" hidden></div><div class="ce-other" hidden><div class="ce-grid">'+fields('ВыделВ',rest,r,'base')+cell('STUR1',r.STUR1,'base','ВыделВ',{label:'Запас на гектар'})+'</div></div></div></div></div><div id="ce-error" role="alert" tabindex="-1"></div></form>';
}

function readValue(el,old){const raw=el.tagName==='SELECT'?el.value:el.value.trim(),field=el.dataset.ceField;
 if(raw==='')return null;
 if(numeric.has(field)){const n=Number(raw.trim().replace(',','.'));if(!Number.isFinite(n))throw Error('Проверьте число: '+el.getAttribute('aria-label'));return n;}
 if(old!=null&&raw===String(old))return old;
 // Access TEXT keys (STL.KTL in particular) may have significant whitespace.
 // Never trim a selected original reference code.
 return el.tagName==='SELECT'&&typeof old==='number'&&Number.isFinite(Number(raw))?Number(raw):raw;
}
function linkedRow(el){
 const scope=el.dataset.ceScope;
 return scope==='base'?session.draft:scope==='quarter'?session.quarter:
  session.draft._children?.[scope]?.[Number(el.dataset.ceRow)]||{};
}
function linkedOrg(){return D.lesnichestvo?.find(x=>same(x.POS,session.draft.POS)&&same(x.LESN,session.draft.LESN))||null;}
function linkedOptions(el){
 const engine=window.SolinDependentRules;
 if(!engine||el.tagName!=='SELECT')return null;
 return engine.options(el.dataset.ceForm,el.dataset.ceField,linkedRow(el),session.draft,linkedOrg());
}
function refreshLinked(){
 if(!session||!window.SolinDependentRules)return;
 const guide=document.getElementById('ce-category-guidance');
 if(guide){
  const info=window.SolinDependentRules.allowedLayers(session.draft,window.SOLIN_REFS?.tables);
  guide.textContent=info.status==='complete'?
   'Категория «'+(info.categoryName||session.draft.KU)+'»: '+(info.items.length?
    'допустимые ярусы — '+info.items.map(x=>x.value+' '+x.label).join('; '):
    'для этой категории ярусы древостоя не предусмотрены'):
   (info.reason||'Не удалось определить допустимые ярусы');
  guide.dataset.ceCategoryStatus=info.status;
 }

 for(const el of document.querySelectorAll('#ce-form select[data-ce-field]')){
  const result=linkedOptions(el);
  if(!result)continue;
  el.title=result.reason||'';
  if(result.status==='unavailable'){
   if(el.dataset.ceField==='M3TLU')el.disabled=true; // Never allow an unverified forest type.
   continue;
  }
  if(el.dataset.ceField==='M3TLU')
   el.disabled=['waiting','empty','ambiguous'].includes(result.status);
  const raw=linkedRow(el)[el.dataset.ceField];
  const current=raw==null?'':String(raw),list=result.items||[];
  const old=el.value;
  const options=[new Option('— Не указано —','')];
  for(const opt of list){
   if(!opt.value)continue;
   options.push(new Option(opt.value+(opt.label?' — '+opt.label:''),opt.value));
  }
  // Imported Access TEXT codes can contain original leading/trailing spaces.
  // Do not rewrite a value merely by rebuilding a dropdown.
  if(current&&!options.some(o=>o.value===current)){
   const match=list.find(x=>String(x.value).trim()===current.trim());
   options.push(new Option('Сохранённый код: '+current+(match?.label?' — '+match.label:''),current));
  }
  const signature=options.map(o=>o.value+'|'+o.textContent).join('\u241e');
  if(el.dataset.linkedSignature!==signature){
   el.replaceChildren(...options);
   el.dataset.linkedSignature=signature;
  }
  el.value=current;
  const cell=el.closest('.dt-cell'),output=cell?.querySelector('output[data-ce-display-for]');
  if(output&&el.dataset.ceField==='M3TLU'){
   const selected=list.find(o=>String(o.value).trim()===current.trim());
   output.textContent=current?(selected?.label||'Проверьте соответствие породе и зоне'):(result.status==='waiting'?'Сначала порода':list.length+' допустимых типа леса');
   output.title=result.reason;
  }
  el.dataset.linkedStatus=result.status;
  el.dataset.linkedCount=String(list.length);
  if(result.status==='waiting')el.title='Сначала выберите главную породу';
  if(old!==current && current && el.value!==current){
   el.title='Исходный код сохранён, проверьте его по справочнику';
  }
 }
}
// Local draft-only correction: do not persist a replacement without Save.
function recalculateEditedField(el){
 const calc=window.SolinCardCalculations;
 if(!session||!calc||!el?.dataset?.ceField)return;
 const {ceField:field,ceScope:scope}=el.dataset;
 const baseFields=new Set(['M3B','STUR','STUR1','KU','PLV','M3Pr']);
 const standFields=new Set(['ZAP','IAR','POR','LET','PH','POL','PROI','KOEF']);
 if(!(scope==='base'&&baseFields.has(field)||scope==='Макет10'&&standFields.has(field)))return;
 // Keep malformed numeric input and its error visible instead of overwriting it.
 if(el.getAttribute('aria-invalid')==='true')return;
 const check=calc.corrections(session.draft,window.SOLIN_REFS?.tables,linkedOrg());
 const changed=[];
 for(const issue of check.issues){
   if(!['M3B','STUR1','STUR','ZAP'].includes(issue.field))continue;
   const isTree=issue.field==='ZAP'&&Number.isInteger(issue.index);
   const prior=isTree?session.draft._children?.Макет10?.[issue.index]?.ZAP:session.draft[issue.field];
   const corrected=issue.field==='M3B'?String(issue.expected):Number(issue.expected);
   if(String(prior??'')===String(corrected))continue;
   if(isTree){
     session.draft._children.Макет10[issue.index].ZAP=corrected;
     session.changedMakets.add('Макет10');
   }else session.draft[issue.field]=corrected;
   changed.push({...issue,previous:prior==null?'Не указано':String(prior),expected:String(corrected)});
   const fieldEl=isTree?
     document.querySelector('#ce-form [data-ce-field="ZAP"][data-ce-scope="Макет10"][data-ce-row="'+issue.index+'"]'):
     document.querySelector('#ce-form [data-ce-field="'+issue.field+'"][data-ce-scope="base"]');
   if(fieldEl){
     if(fieldEl.tagName==='SELECT'&&!Array.from(fieldEl.options).some(o=>o.value===String(corrected)))
       fieldEl.add(new Option(String(corrected),String(corrected)));
     fieldEl.value=String(corrected);
     const output=document.querySelector('[data-ce-display-for="'+fieldEl.id+'"]');
     if(output)output.textContent=description(isTree?'Макет10':'ВыделВ',issue.field,corrected);
   }
 }
 if(!changed.length)return;
 session.dirty=true;
 const status=document.getElementById('ce-status');
 if(status)status.textContent='Пересчитано · не сохранено';
 session.calcNotices??=[];
 session.calcShown??=new Set();
 const fresh=changed.filter(item=>{
   if(session.calcShown.has(item.field))return false;
   session.calcShown.add(item.field);return true;
 });
 if(!fresh.length)return;
 session.calcNotices.push(...fresh);
 const notice=document.getElementById('ce-calc-notice');
 if(!notice)return;
 notice.hidden=false;
 notice.innerHTML='<div class="ce-calc-heading"><strong>Проверка расчётов SOLI-N · исправлено в черновике</strong>'+
   '<button type="button" data-ce-calc-close aria-label="Скрыть таблицу расчётов">×</button></div>'+
   '<p>Первоначальное значение не совпало с расчётом. Правильное значение уже подставлено в карточку, но <b>запись ещё не сохранена</b>.</p>'+
   '<div class="ce-calc-table-wrap"><table><thead><tr><th>Поле</th><th>Введено впервые</th><th>Расчётное</th><th>Основание</th></tr></thead><tbody>'+
   session.calcNotices.map(item=>'<tr><td>'+h(item.label)+'</td><td>'+h(item.previous)+'</td><td><b>'+h(item.expected)+'</b></td><td>'+h(item.reason)+'</td></tr>').join('')+
   '</tbody></table></div>';
 notice.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function linkedIssues(){
 const engine=window.SolinDependentRules;
 if(!engine||!session)return null;
 const base=session.draft,before=session.original;
 const changed=(row,prior,names)=>names.some(k=>String(row?.[k]??'')!==String(prior?.[k]??''));
 if(changed(base,before,['M3Pr'])||session.isNew){
  const speciesChoice=engine.options('ВыделВ','M3Pr',base,base,linkedOrg());
  if(engine.currentIsAllowed(base.M3Pr,speciesChoice)===false)
   return {message:'Выберите допустимую главную породу из оригинального справочника.',form:'ВыделВ',scope:'base',field:'M3Pr'};
 }
 const affected={
  M3TLU:['M3Pr','M3TLU','KlxrVD','NE2A'],
  M22:['M2PM1','M22'],M23:['M2PM1','M22','M23'],
  PRP2:['PRP1','PRP2'],PRP3:['PRP1','PRP2','PRP3'],
  PLP2:['PLP1','PLP2'],PLP3:['PLP1','PLP2','PLP3']
 };
 for(const [field,deps] of Object.entries(affected)){
  if(!changed(base,before,deps)&&!session.isNew)continue;
  const result=engine.options('ВыделВ',field,base,base,linkedOrg());
  const valid=engine.currentIsAllowed(base[field],result);
  if(field==='M3TLU'&&String(base[field]??'').trim()!==''&&result?.status==='unavailable')
   return {message:'Не удалось проверить тип леса: нет справочника пород, кода региона или лесохозяйственной зоны. Сначала восстановите справочники/контекст.',form:'ВыделВ',scope:'base',field};
  if(valid===false && String(base[field]??'').trim()!=='0'){
   return {message:'Значение «'+title('ВыделВ',field)+'» не соответствует выбранной породе или предыдущим полям. Выберите значение из подходящего списка.',form:'ВыделВ',scope:'base',field};
  }
 }
 if(changed(session.quarter,session.originalQuarter,['Kpz','Klxr'])){
  const result=engine.options('Квартал','Klxr',session.quarter,base,linkedOrg());
  if(engine.currentIsAllowed(session.quarter.Klxr,result)===false)
   return {message:'Лесохозяйственная зона квартала не соответствует выбранной природной зоне.',form:'Квартал',scope:'quarter',field:'Klxr'};
 }
 // Category KU determines permitted Maket 10 strata via SKU.P10 → SIAR.Ia.
 // Validate only when KU was changed or the Maket 10 itself was edited,
 // so unrelated edits to historical imported cards stay untouched.
 if(session.isNew||changed(base,before,['KU'])||session.changedMakets.has('Макет10')){
  const forestLayers=engine.allowedLayers(base,window.SOLIN_REFS?.tables);
  if(forestLayers.status==='complete'){
   const layers=base._children?.Макет10||[];
   for(let i=0;i<layers.length;i++){
    const layer=layers[i]?.IAR;
    if(layer==null||String(layer)==='0'||String(layer)==='')continue;
    if(engine.currentIsAllowed(layer,forestLayers)===false)
     return {message:'Ярус '+layer+' не допускается для категории угодий «'+(forestLayers.categoryName||base.KU)+'». Выберите допустимый ярус в макете 10.',form:'Макет10',scope:'Макет10',field:'IAR',index:i};
   }
  }
 }
 // Original maket 12 SBR RowSource excludes repeated first/second damage code.
 if(session.changedMakets.has('Макет12')){
  for(const [i,row] of (base._children?.Макет12||[]).entries()){
   if(row.VV!=null&&row.VB!=null&&String(row.VV)!=='0'&&String(row.VV)===String(row.VB))
    return {message:'Макет 12: второй вредитель или болезнь не должен повторять первый код.',form:'Макет12',scope:'Макет12',field:'VB',index:i};
  }
 }
 // Native dependencies also apply to the additional maket rows, and a
 // changed Maket 10 species must not leave Maket 16 linked to another tree.
 for(const form of ['Макет12','Макет16']){
  const active=session.changedMakets.has(form)||(form==='Макет16'&&session.changedMakets.has('Макет10'));
  if(!active)continue;
  const rows=base._children?.[form]||[],oldRows=before._children?.[form]||[];
  const dependencies=form==='Макет12'?{SV:['KTP','SV'],SB:['SB'],VV:['VV','VB'],VB:['VV','VB']}:{Por16:['Por16']};
  for(let i=0;i<rows.length;i++){
   for(const [field,upstream] of Object.entries(dependencies)){
    const relevant=form==='Макет16'&&session.changedMakets.has('Макет10')||
      session.isNew||changed(rows[i],oldRows[i],upstream);
    if(!relevant||rows[i][field]==null||String(rows[i][field]).trim()==='')continue;
    const result=engine.options(form,field,rows[i],base,linkedOrg());
    if(form==='Макет16'&&result?.status==='waiting'||
      engine.currentIsAllowed(rows[i][field],result)===false&&String(rows[i][field])!=='0')
     return {message:form+': «'+title(form,field)+'» не согласовано с предыдущими данными карточки.',form,scope:form,field,index:i};
   }
  }
 }
 // For maket 23 restrict repeated and out-of-order codes only after editing.
 for(const [form,rows] of Object.entries(base._children||{})){
  if(form!=='Макет23'||!session.changedMakets.has(form))continue;
  for(let i=0;i<rows.length;i++){
   for(let n=1;n<=8;n++){
    const field='K'+n,result=engine.options(form,field,rows[i],base,linkedOrg());
    const value=rows[i][field],valid=engine.currentIsAllowed(value,result);
    if(valid===false && String(value??'').trim()!=='0')
     return {message:'Макет 23: код '+n+' повторяется или недопустим в последовательности.',form,scope:form,field,index:i};
   }
  }
 }
 return null;
}
function capture(el){if(!el.matches('[data-ce-field]'))return;
 const {ceScope:scope,ceField:field,ceRow:index}=el.dataset;
 if(scope.startsWith('Макет')&&!session.draft._children[scope]?.[Number(index)]){(session.draft._children[scope]??=[]).push(newTableRow(scope));el.closest('tr')?.removeAttribute('data-ce-placeholder');session.changedMakets.add(scope);}
 const target=scope==='base'?session.draft:scope==='quarter'?session.quarter:session.draft._children[scope][Number(index)];
 const previous=target[field];
 try{target[field]=readValue(el,target[field]);el.removeAttribute('aria-invalid');el.setCustomValidity('');}
 catch(e){el.setAttribute('aria-invalid','true');el.setCustomValidity(e.message);}
 if(scope==='Макет10'&&field==='POR'&&window.SolinDependentRules){
  const engine=window.SolinDependentRules,refs=window.SOLIN_REFS?.tables;
  const suggested=engine.suggestedOrigin(target.POR,refs),oldSuggested=engine.suggestedOrigin(previous,refs);
  const currentOrigin=target.PROI;
  if(suggested!==null&&(currentOrigin==null||String(currentOrigin)==='0'||oldSuggested!==null&&String(currentOrigin)===String(oldSuggested))){
   target.PROI=suggested;
   const originEl=document.getElementById('ce_'+scope+'_'+index+'_PROI');
   if(originEl){
    if(originEl.tagName==='SELECT'&&!Array.from(originEl.options).some(o=>o.value===String(suggested)))
      originEl.add(new Option(String(suggested),String(suggested)));
    originEl.value=String(suggested);
   }
  }
 }
 const output=document.querySelector('[data-ce-display-for="'+el.id+'"]');if(output)output.textContent=description(el.dataset.ceForm,field,target[field]);
 session.dirty=true;document.querySelector('#ce-status').textContent='Изменено';
 refreshLinked();
}
function error(message,el,location){const box=document.querySelector('#ce-error');box.textContent=message;
 if(location?.form){if(location.form.startsWith('Макет')&&location.form!=='Макет10')showExtra(location.form);else showMain();el=document.querySelector('[data-ce-scope="'+location.scope+'"][data-ce-field="'+location.field+'"]'+(location.index==null?'':'[data-ce-row="'+location.index+'"]'));}
 const main=document.querySelector('#ce-main'),extra=document.querySelector('#ce-extra');
 if(el){const form=el.dataset.ceScope;if(form.startsWith('Макет')&&form!=='Макет10')showExtra(form);else{main.hidden=false;extra.hidden=true;}}
 if(el?.closest('.ce-other'))showSupport();
 const target=el?.isConnected?el:box;target.closest('details')?.setAttribute('open','');target.focus();target.scrollIntoView({block:'center',inline:'center'});
}
function rerenderTable(form){document.getElementById('ce-table-'+form).innerHTML=table(form);refreshLinked();}
function showMain(jump){document.querySelector('#ce-main').hidden=false;document.querySelector('#ce-extra').hidden=true;
 document.querySelector('#ce-action-panel').hidden=true;
 document.querySelectorAll('[data-ce-extra]').forEach(b=>b.removeAttribute('aria-current'));
 if(jump)document.getElementById('ce-section-'+jump)?.scrollIntoView({block:'start',behavior:'smooth'});
 else document.querySelector('.ce-summary').scrollIntoView({block:'start'});
}
function showExtra(form){const root=document.querySelector('#ce-extra');
 document.querySelector('#ce-main').hidden=false;document.querySelector('#ce-action-panel').hidden=true;root.hidden=false;
 if(root.dataset.form!==form){root.dataset.form=form;root.innerHTML='<div class="dt-subtitle"><span>Макет '+h(form.replace('Макет',''))+' — '+h(SolinHuman.formName(form))+'</span><button type="button" data-ce-main aria-label="Закрыть макет">×</button></div><div class="dt-subbody"><div id="ce-table-'+h(form)+'">'+table(form)+'</div></div>';}
 document.querySelectorAll('[data-ce-extra]').forEach(b=>{if(b.dataset.ceExtra===form)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
 refreshLinked();root.scrollIntoView({block:'nearest',inline:'nearest'});
}
function setZoom(value){const viewport=document.querySelector('.dt-viewport'),fit=viewport.clientWidth/DESKTOP_WIDTH;
 let scale=value==='fit'?fit:value==='actual'?1:value==='in'?(session.zoom||1)+.15:value==='out'?(session.zoom||1)-.15:Number(value);
 scale=Math.max(Math.min(fit,.25),Math.min(2,scale));session.zoom=scale;const stage=viewport.querySelector('.dt-stage');stage.style.width=DESKTOP_WIDTH*scale+'px';stage.style.height=DESKTOP_HEIGHT*scale+'px';stage.querySelector('.dt-board').style.transform='scale('+scale+')';document.querySelector('#ce-zoom').textContent=Math.round(scale*100)+'%';if(value==='fit'||value==='actual'){viewport.scrollLeft=0;viewport.scrollTop=0;}
}
function panel(caption,html){const root=document.querySelector('#ce-action-panel');document.querySelector('#ce-extra').hidden=true;root.hidden=false;root.innerHTML='<div class="dt-subtitle"><span>'+h(caption)+'</span><button type="button" data-ce-main aria-label="Закрыть окно">×</button></div><div class="dt-subbody">'+html+'</div>';root.scrollIntoView({block:'nearest',inline:'nearest'});return root;}
function showSupport(){panel('Дополнительные поля карточки','').querySelector('.dt-subbody').append(session.supportGrid);}
function showMaketNavigator(){
 const standard=sections.map(([n,label])=>({n,label,kind:'standard'}));
 const others=[{n:'10',label:'Таксационная характеристика древостоя',kind:'table'},
   ...extras.map(n=>({n:String(n),label:SolinHuman.formName('Макет'+n),kind:'table'}))];
 const items=[...standard,...others].sort((a,b)=>Number(a.n)-Number(b.n));
 const html='<p class="ce-maket-guide">Макеты выбранного выдела. Число записей берётся из текущей карточки. Изменения сохраняются только кнопкой «Сохранить».</p>'+
  '<div class="ce-maket-nav">'+items.map(item=>{
   const form='Макет'+item.n;
   const count=item.kind==='table'?(session.draft._children?.[form]?.length||0):null;
   return '<button type="button" class="ce-maket-nav-item" data-ce-nav-maket="'+h(item.n)+'">'+
    '<b>Макет '+h(item.n)+'</b><span>'+h(item.label)+'</span>'+
    (count==null?'':'<small>'+count+' зап.</small>')+'</button>';
  }).join('')+'</div>';
 panel('Навигатор макетов',html);
}
function focusControlIssue(issue){
 const form=issue.form||'ВыделВ';if(form==='ВыделВ')showMain();else if(form==='Макет10')showMain('10');else showExtra(form);
 const scope=form==='ВыделВ'?'base':form;const fields=[...document.querySelectorAll('[data-ce-scope="'+scope+'"]')];
 const target=fields.find(el=>(!issue.field||el.dataset.ceField===issue.field)&&(issue.row==null||Number(el.dataset.ceRow)===issue.row));
 if(target){target.closest('details')?.setAttribute('open','');target.focus();target.scrollIntoView({block:'center',inline:'nearest'});}
}
function showChecks(group=''){
 const currentSession=session,r=session.draft,q=D.quarters[String(r.KV)],rows=q.quarterRows?.length?q.quarterRows:[q.meta||{}];
 const cards=q.compartments.includes(session.record)?q.compartments.map(x=>x===session.record?r:x):[...q.compartments,r];
 const database={...D,quarters:{...D.quarters,[r.KV]:{...q,compartments:cards,quarterRows:rows.map(x=>x===session.quarterTarget?session.quarter:x)}}};
 const host=panel('Контроль карточки','<div id="ce-control-report"></div>').querySelector('#ce-control-report');
 SolinControlUI.mount(host,{records:[r],database,draft:true,caption:'Квартал '+r.KV+' · выдел '+r.VD,group,onNavigate:issue=>{if(session===currentSession)focusControlIssue(issue);}});
}
function preview(print){const popup=window.open('','_blank');if(!popup)return toast('Разрешите открытие окна карточки');const paper=document.querySelector('.dt-board').cloneNode(true);paper.querySelectorAll('#ce-extra,#ce-action-panel,.ce-other').forEach(e=>e.remove());for(const el of paper.querySelectorAll('input,select')){const span=document.createElement('output');span.textContent=el.tagName==='SELECT'?el.selectedOptions[0]?.textContent||'':el.value;el.replaceWith(span);}paper.querySelectorAll('button').forEach(b=>b.disabled=true);paper.style.transform='none';const css=new URL('solin-card-editor.css?v=20261023-6',location.href).href;popup.document.write('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Карточка таксации — КТ</title><link rel="stylesheet" href="'+h(css)+'"><style>body{margin:8px;background:#eee}.ce-print{display:block;position:static}.ce-print .dt-board{position:relative}.print-action{margin-bottom:8px}</style><button class="print-action" onclick="print()">Печать</button><div class="ce-modal ce-print">'+paper.outerHTML+'</div><p style="font:11px Arial">Предварительный просмотр карточки. Официальное таксационное описание формируется в настольной SOLI-N.</p></html>');popup.document.close();if(print)popup.addEventListener('load',()=>popup.print(),{once:true});}
function newCard(e){const previous=session.draft,kv=previous.KV;if(!save(e))return;const q=D.quarters[kv],org=D.lesnichestvo?.[0]||{},r=Object.fromEntries((D.transfSchema['Выдел']||[]).map(f=>[f,null]));for(const f of numeric)if(f in r)r[f]=0;for(const f of ['CR','OZU','ErV','ErCt','M2PM1','M22','M23','PLG'])r[f]=0;Object.assign(r,{POS:previous.POS??org.POS,LESN:previous.LESN??org.LESN,KV:kv,KGLF:previous.KGLF,VD:Math.max(0,...q.compartments.filter(x=>same(x.POS,previous.POS)&&same(x.LESN,previous.LESN)&&same(x.KGLF,previous.KGLF)).map(x=>Number(x.VD)||0))+1,PLV:null,KU:null,Fzona:previous.Fzona,KlxrVD:previous.KlxrVD,_children:{},_local:true});open(r,{isNew:true});}
function updateBadges(form){const n=session.draft._children[form]?.length||0;document.querySelectorAll('[data-ce-badge="'+form+'"]').forEach(b=>b.textContent=n||'');}
function validate(){
 const linkIssue=linkedIssues();if(linkIssue)throw linkIssue;
 const invalid=document.querySelector('#ce-form [aria-invalid="true"]');if(invalid)throw {message:invalid.validationMessage,el:invalid};
 if(!(Number(session.draft.PLV)>0))throw {message:'Площадь выдела должна быть больше нуля.',el:document.querySelector('[data-ce-field="PLV"]')};
 if(session.isNew){if(!Number.isInteger(Number(session.draft.VD))||Number(session.draft.VD)<1)throw {message:'Номер выдела должен быть положительным целым.',el:document.querySelector('[data-ce-field="VD"]')};if(D.quarters[session.draft.KV].compartments.some(r=>keys.every(k=>same(r[k],session.draft[k]))))throw {message:'Выдел с таким номером и категорией ГЛФ уже есть.',el:document.querySelector('[data-ce-field="VD"]')};if(session.draft.KU==null||Number(session.draft.KU)===0)throw {message:'Выберите категорию угодий.',el:document.querySelector('[data-ce-field="KU"]')};}
 const year=session.quarter.GodT;if(year!=null&&(!Number.isInteger(Number(year))||Number(year)<1900||Number(year)>2200))throw {message:'Укажите год таксации от 1900 до 2200.',el:document.querySelector('[data-ce-field="GodT"]')};
 const check=(form,row,before)=>{const failed=(solinCore.validateRow(form,row,session.draft)||[]).filter(m=>{const f=m.split(':')[0];return !before||!same(row[f],before[f]);});if(failed.length){const field=failed[0].split(':')[0],scope=form==='ВыделВ'?'base':form==='Квартал'?'quarter':form,index=form.startsWith('Макет')?session.draft._children[form].indexOf(row):null;throw {message:'Проверьте поле «'+title(form,field)+'»'+(form.startsWith('Макет')?' в макете '+form.replace('Макет',''):'')+'.',form,scope,field,index};}};
 check('ВыделВ',session.draft,session.original);check('Квартал',session.quarter,session.originalQuarter);
 for(const [index,row]of(session.draft._children.Макет10||[]).entries())if(!session.baselines.has(row)&&(!row.POR||!row.IAR))throw {message:'Укажите породу и ярус в новой строке макета 10.',form:'Макет10',scope:'Макет10',field:row.POR?'IAR':'POR',index};
 for(const form of session.changedMakets)for(const row of session.draft._children[form]||[])check(form,row,session.baselines.get(row));
}
function cleanup(){if(!session)return;const s=session;session=null;const modal=document.querySelector('#modal');modal.classList.remove('ce-modal');modal.removeAttribute('role');modal.removeAttribute('aria-modal');modal.removeAttribute('aria-labelledby');
 document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKey);window.removeEventListener('beforeunload',onUnload);
 modal.querySelector('.close').onclick=s.closeButton;
 document.querySelector('#ce-form')?.remove();previousFocus?.focus();
}
function close(){cleanup();closeModal();}
function cancel(){if(session?.dirty&&!confirm('Закрыть карточку без сохранения изменений?'))return;close();}
function onUnload(e){if(session?.dirty){e.preventDefault();e.returnValue='';}}
function onKey(e){if(!session)return;if(e.key==='Escape'){e.preventDefault();cancel();return;}
 if(e.key==='Enter'&&e.target.matches('[data-ce-field]')&&e.target.tagName!=='SELECT'){e.preventDefault();const fields=[...document.querySelectorAll('#ce-form [data-ce-field]')].filter(el=>el.getClientRects().length&&!el.disabled&&!el.readOnly);const next=fields[fields.indexOf(e.target)+1];next?.focus();next?.select?.();return;}
 if(e.key==='Tab'){const visible=[...document.querySelectorAll('.ce-modal button,.ce-modal input,.ce-modal select,.ce-modal summary,[role="dialog"] [tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.disabled),first=visible[0],last=visible.at(-1);if(e.shiftKey&&document.activeElement===first){last?.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first?.focus();e.preventDefault();}}
}
function save(e){e?.preventDefault();if(!session)return false;const s=session;
 try{validate()}catch(err){error(err.message,err.el,err);return;}
 const before=clone(s.record),beforeQuarter=clone(s.quarterTarget),oldWork=localStorage.getItem('solin_field_audited_work_v1'),oldCheckpoint=localStorage.getItem('solin_field_checkpoint_v2');
 try{Object.assign(s.record,clone(s.draft));for(const rows of Object.values(s.record._children||{}))for(const row of rows)for(const k of keys)row[k]=s.record[k]??null;
 Object.assign(s.quarterTarget,clone(s.quarter));
 if(s.isNew)D.quarters[s.record.KV].compartments.push(s.record);
 // The existing writer keeps legacy patches and the canonical checkpoint consistent.
 solinWorkflow.saveAll(s.record);
 }catch(err){for(const k of Object.keys(s.record))delete s.record[k];Object.assign(s.record,before);for(const k of Object.keys(s.quarterTarget))delete s.quarterTarget[k];Object.assign(s.quarterTarget,beforeQuarter);
 if(s.isNew)D.quarters[s.record.KV].compartments=D.quarters[s.record.KV].compartments.filter(r=>r!==s.record);
 try{for(const [key,value]of[['solin_field_audited_work_v1',oldWork],['solin_field_checkpoint_v2',oldCheckpoint]])if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch(_){}
 error('Не удалось сохранить карточку: '+err.message);return;}
 current=s.record;close();renderComp();refresh();toast('Карточка сохранена');return true;
}
function click(e){const b=e.target.closest('button');if(!b)return;
 if(b.dataset.ceZoom){setZoom(b.dataset.ceZoom);return;}
 if(b.hasAttribute('data-ce-support')){showSupport();return;}
 if(b.hasAttribute('data-ce-makets')){showMaketNavigator();return;}
 if(b.dataset.ceNavMaket){
   const invalid=document.querySelector('#ce-form [aria-invalid="true"]');
   if(invalid){error(invalid.validationMessage,invalid);return;}
   const number=b.dataset.ceNavMaket;
   if(['1','2','3','4','5','10','31','32'].includes(number))showMain(number);
   else if(extras.includes(Number(number)))showExtra('Макет'+number);
   return;
 }
 if(b.hasAttribute('data-ce-controls')){showChecks(b.dataset.ceControls);return;}
 if(b.hasAttribute('data-ce-preview')||b.hasAttribute('data-ce-print')){preview(b.hasAttribute('data-ce-print'));return;}
 if(b.hasAttribute('data-ce-new')){newCard(e);return;}
 if(b.dataset.ceRecord){selectRecord(b.dataset.ceTable,b.dataset.ceRecord);return;}
 if(b.dataset.ceJump||b.hasAttribute('data-ce-main')||b.dataset.ceExtra||b.dataset.ceAdd||b.dataset.ceDelete){const invalid=document.querySelector('#ce-form [aria-invalid="true"]');if(invalid){error(invalid.validationMessage,invalid);return;}}
 if(b.dataset.ceJump){showMain(b.dataset.ceJump);return;}
 if(b.hasAttribute('data-ce-main')){showMain();return;}
 if(b.dataset.ceExtra){showExtra(b.dataset.ceExtra);return;}
 if(b.classList.contains('ce-table-toggle')){const table=b.closest('.ce-section').querySelector('.ce-table-wrap');table.classList.toggle('ce-table-mode');b.setAttribute('aria-pressed',table.classList.contains('ce-table-mode'));b.textContent=table.classList.contains('ce-table-mode')?'Строками':'Таблица';return;}
 const form=b.dataset.ceAdd||b.dataset.ceDelete;if(!form)return;
 if(b.dataset.ceDelete&&!session.draft._children[form]?.length)return;
 if(b.dataset.ceAdd){(session.draft._children[form]??=[]).push(newTableRow(form));}
 else{if(!confirm('Удалить запись '+(Number(b.dataset.ceIndex)+1)+' макета '+form.replace('Макет','')+'? Изменения применятся после сохранения карточки.'))return;session.draft._children[form].splice(Number(b.dataset.ceIndex),1);}
 session.changedMakets.add(form);session.dirty=true;document.querySelector('#ce-status').textContent='Есть несохранённые изменения';rerenderTable(form);updateBadges(form);
 if(b.dataset.ceAdd)document.getElementById('ce-table-'+form).querySelector('tbody tr:last-child input,tbody tr:last-child select')?.focus();
}
function selectRecord(form,value){const rows=session.draft._children[form]||[],table=document.getElementById('ce-table-'+form);let selected=session.selected?.[form]||0;selected=value==='first'?0:value==='last'?rows.length-1:value==='next'?selected+1:value==='previous'?selected-1:Number(value);selected=Math.max(0,Math.min(Math.max(0,rows.length-1),selected));(session.selected??={})[form]=selected;table.querySelectorAll('tbody tr').forEach((tr,i)=>{tr.classList.toggle('dt-selected',i===selected);tr.querySelector('th').textContent=i===selected?'►':'';});table.querySelector('[data-ce-delete]').dataset.ceIndex=selected;table.querySelector('[data-ce-count]').textContent=rows.length?(selected+1)+' из '+rows.length:'Новая';}
function open(record,options={}){if(!record)return;
 if(window.SolinWorkspace?.activeId &&
    window.SolinWorkspace.activeId!==String(record.POS)+'::'+String(record.LESN))
   return toast('Карточка принадлежит другому лесничеству. Переключите рабочее лесничество.');
 const q=D.quarters?.[String(record.KV)];
 if(!q)return toast('Квартал выбранной карточки не найден в рабочем лесничестве.');
 const quarter=quarterForRecord(record);
 if(!quarter)return toast('Строка квартала не найдена или неоднозначна по адресу, секции и функциональной зоне. Изменения не выполнялись.');
 previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;
 session={record,original:clone(record),draft:clone(record),quarterTarget:quarter,originalQuarter:clone(quarter),quarter:clone(quarter),dirty:false,changedMakets:new Set(),closeButton:document.querySelector('#modal .close').onclick};
 session.isNew=!!options.isNew;
 session.draft._children??={};
 session.baselines=new WeakMap();for(const [form,children]of Object.entries(session.draft._children))children.forEach((row,i)=>session.baselines.set(row,session.original._children[form][i]));
 if(session.quarter.GodT==null)session.quarter.GodT=D.lesnichestvo?.[0]?.GodT??null;
 openModal('Карточка таксации',markup());const modal=document.querySelector('#modal');modal.classList.add('ce-modal');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','modalTitle');document.body.style.overflow='hidden';session.supportGrid=document.querySelector('.ce-other .ce-grid');setZoom('actual');
 modal.querySelector('.close').onclick=cancel;
 const form=document.querySelector('#ce-form');form.addEventListener('input',e=>{capture(e.target);if(e.target.dataset.ceScope?.startsWith('Макет'))session.changedMakets.add(e.target.dataset.ceScope)});
 form.addEventListener('change',e=>{
  if(e.target.matches('.dt-maket-select')){const n=e.target.value;e.target.value='';if(n==='10'||n==='31'||n==='32')showMain(n);else if(n)showExtra('Макет'+n);return;}
  capture(e.target);
  if(e.target.dataset.ceScope?.startsWith('Макет'))session.changedMakets.add(e.target.dataset.ceScope);
  recalculateEditedField(e.target);
 });
 form.addEventListener('click',e=>{
  if(e.target.closest('[data-ce-calc-close]')){const notice=document.getElementById('ce-calc-notice');if(notice)notice.hidden=true;return;}
  const cell=e.target.closest('[data-ce-select]');if(cell)selectRecord(cell.dataset.ceSelectForm,Number(cell.dataset.ceSelect));
 });
 refreshLinked();
 form.addEventListener('click',click);form.addEventListener('submit',save);document.querySelector('#ce-cancel').onclick=cancel;
 document.addEventListener('keydown',onKey);window.addEventListener('beforeunload',onUnload);modal.querySelector('.modalCard').scrollTop=0;modal.querySelector('.close').focus();if(options.focus)focusControlIssue(options.focus);
}
window.addEventListener('solin-refs-ready',()=>{if(session)refreshLinked()});
window.SolinCardEditor={open,resolveQuarter:quarterForRecord,refreshDependencies:refreshLinked};
})();
