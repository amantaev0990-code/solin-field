const SOLIN_DELETE_ICON='<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v7m4-7v7"/></svg>';window.solinDeleteIcon=SOLIN_DELETE_ICON;
let D=null,current=null,gps=null;const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const friendly={KU:'Категория угодий',PLV:'Площадь, га',KV:'Квартал',VD:'Выдел',KGLF:'Категория лесного фонда',Fzona:'Функциональная зона',OZU:'Особо защитный участок',M3Pr:'Преобладающая порода',M3B:'Класс бонитета',M3TL:'Тип леса',M3TLU:'Тип лесорастительных условий',M3G:'Группа возраста',M3KP:'Класс пожарной опасности',M2PM1:'Проектируемое мероприятие',M2Pr:'Интенсивность выборки, %',PRkol:'Количество подроста, тыс. шт./га',PRH:'Средняя высота подроста, м',PRA:'Возраст подроста',POR:'Порода',LET:'Возраст, лет',PH:'Высота, м',PD2:'Диаметр, см',POL:'Полнота',ZAP:'Запас, м³/га',IAR:'Ярус',KOEF:'Коэффициент состава',KT:'Класс товарности',PROI:'Происхождение',SPS:'Состояние',TB:'Тип болота',TR:'Тип растительности',MTC:'Мощность торфа, дм',ZP:'Порода зарастания',ZPR:'Зарастание, %'};
const refNames={SKU:'Категории угодий',SDP:'Древесные и кустарниковые породы',SIAR:'Ярусы древостоя',SBon:'Классы бонитета',STB:'Типы болот',SLM:'Проектируемые мероприятия',SProi:'Происхождение насаждений',STPD:'Типы повреждений'};
const childNames={Макет10:'Древостой',Макет11:'Лесные культуры',Макет12:'Повреждение насаждений',Макет13:'Земли линейного протяжения',Макет14:'Травяные растения, ягодники',Макет15:'Выполненные хозяйственные мероприятия',Макет16:'Недревесное сырьё',Макет17:'Сельскохозяйственные угодья',Макет19:'Болото',Макет20:'Потери древесины',Макет21:'Ландшафтная характеристика',Макет23:'Особенности выдела',Макет25:'Плантация, древесная школа',Макет27:'Прежнее угодье',Макет28:'Доступность для транспорта'};
async function getJSON(u){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error(u);return r.json()}
function esc(v){if(v===null||v===undefined||v==='')return '—';return String(v).replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]||m))}function num(v,d=1){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('ru-RU',{maximumFractionDigits:d}):'—'}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function show(id){$$('.screen').forEach(x=>x.classList.remove('active'));$('#'+id)?.classList.add('active');$$('.sectionTab').forEach(x=>x.classList.toggle('active',x.dataset.s===id));scrollTo({top:0,behavior:'smooth'})}
function lookup(k,v){const maps=D?.fieldLookups||{};const aliases={M3Pr:'POR',PORP:'POR',P15:'POR',PRP1:'POR',PRP2:'POR',PRP3:'POR',PLP1:'POR',PLP2:'POR',PLP3:'POR'};const m=maps[k]||maps[aliases[k]];return m?.[String(v)]??v}
function landName(v){return lookup('KU',v)||''}function speciesName(v){return lookup('POR',v)||''}
function saveLocal(){const obj={quarters:{}};for(const[k,q]of Object.entries(D.quarters))if(q._local||q.compartments.some(x=>x._local))obj.quarters[k]={_local:q._local||false,meta:q.meta||{},compartments:q.compartments.filter(x=>x._local)};localStorage.setItem('solin_user_data_v1',JSON.stringify(obj))}
function mergeLocal(){try{const L=JSON.parse(localStorage.getItem('solin_user_data_v1')||'{}');for(const[k,q]of Object.entries(L.quarters||{})){if(!D.quarters[k])D.quarters[k]={meta:q.meta||{},compartments:[],_local:true};for(const r of q.compartments||[]){if(!D.quarters[k].compartments.some(x=>String(x.VD)===String(r.VD)&&x._local))D.quarters[k].compartments.push(r)}}}catch(e){console.warn(e)}}
async function boot(){try{const mf=await getJSON('./data-manifest.json');D=await getJSON('./data-meta.json');const chunks=await Promise.all(mf.quarterChunks.map(f=>getJSON('./'+f)));D.quarters=Object.assign({},...chunks);D.references=D.references||{};mergeLocal();refresh();renderFriendlyRefs();renderDb();window.dispatchEvent(new Event('solin-ready'))}catch(e){console.error(e);toast('Ошибка загрузки данных: '+e.message);document.querySelector('#quarters').innerHTML='<button class="widePrimary" onclick="boot()">Повторить загрузку</button>'}}
function totals(){const qs=Object.values(D.quarters),comps=qs.flatMap(q=>q.compartments||[]);return{q:qs.length,v:comps.length,a:comps.reduce((s,r)=>s+(+r.PLV||0),0)}}
function refresh(){const t=totals();$('#qcount').textContent=t.q;$('#vcount').textContent=t.v;$('#area').textContent=num(t.a);$('#rcount').textContent=D.stats?.referenceTables||132;$('#qheadCount').textContent='('+t.q+')';$('#vheadCount').textContent='('+t.v+')';renderQuarters();renderAllComps()}
function renderQuarters(filter=''){const box=$('#quarters');box.innerHTML='';Object.keys(D.quarters).sort((a,b)=>+a-+b).filter(k=>!filter||k.includes(filter.trim())).forEach(k=>{const q=D.quarters[k],rs=q.compartments||[],a=rs.reduce((sum,r)=>sum+(+r.PLV||0),0);const b=document.createElement('button');b.type='button';b.className='quarterCard';b.innerHTML=`<span class="quarterNo">${esc(k)}</span><span class="quarterText"><b>Квартал ${esc(k)}</b><small>Выделов: ${rs.length}</small><small>Площадь: ${num(a)} га</small></span><span class="arrow">›</span>`;b.onclick=()=>openQuarter(k);const entry=document.createElement('div');entry.className='record-entry';const remove=document.createElement('button');remove.type='button';remove.className='record-delete';remove.innerHTML=SOLIN_DELETE_ICON;remove.title='Удалить квартал '+k;remove.setAttribute('aria-label','Удалить квартал '+k);remove.onclick=()=>openDeleteQuarter(k);entry.append(b,remove);box.appendChild(entry)});if(!box.children.length)box.innerHTML='<div class="empty">Кварталы не найдены</div>'}
// The desktop "Список кварталов" selects a row by KV + KGLF.
// A quarter can span multiple KGLF rows; group at the user-interface layer only.
function quarterCategories(q){
 const values=new Set([...(q.quarterRows||[]).map(r=>r.KGLF),...(q.compartments||[]).map(r=>r.KGLF)].filter(v=>v!==undefined&&v!==null&&v!=='').map(String));
 return [...values].sort((a,b)=>Number(a)-Number(b)||a.localeCompare(b,'ru'));
}
function openQuarter(k,selectedKGLF=null){
 const q=D.quarters?.[k],box=$('#quarters');if(!q||!box)return;
 const categories=quarterCategories(q),selected=selectedKGLF==null?null:String(selectedKGLF);
 const scoped=selected==null?q.compartments||[]:(q.compartments||[]).filter(r=>String(r.KGLF)===selected);
 const area=scoped.reduce((sum,r)=>sum+(Number(r.PLV)||0),0);
 const all=selected==null&&categories.length>1;
 box.innerHTML=`<div class="screenHead"><div><h2>Квартал ${esc(k)}</h2><p>${scoped.length} выделов · ${num(area,2)} га${selected==null?'':' · КГЛФ '+esc(selected)}</p></div><div class="quarter-head-actions"><button type="button" class="record-delete quarter-head-delete" id="qDelete" title="Удалить квартал" aria-label="Удалить квартал ${esc(k)}">${SOLIN_DELETE_ICON}</button><button class="iconbtn" id="qReturn" aria-label="Назад">‹</button></div></div><div id="qCategoryList"></div><div id="qActions"></div><div id="qComps"></div>`;
 $('#qReturn').onclick=()=>selected!=null&&categories.length>1?openQuarter(k):renderQuarters();
  $('#qDelete').onclick=()=>openDeleteQuarter(k);
 if(all){
  const menu=$('#qCategoryList');
  menu.innerHTML='<p class="quarterCategoryHint">В настольном SOLI-N один квартал отображается отдельно по категориям ГЛФ. Выберите строку:</p>';
  for(const cat of categories){
   const subset=(q.compartments||[]).filter(r=>String(r.KGLF)===cat);
   const hectares=subset.reduce((sum,r)=>sum+(Number(r.PLV)||0),0);
   const button=document.createElement('button');button.type='button';button.className='quarterCard';
   button.innerHTML=`<span class="quarterNo">${esc(cat)}</span><span class="quarterText"><b>КГЛФ ${esc(cat)}</b><small>Выделов: ${subset.length}</small><small>Площадь: ${num(hectares,2)} га</small></span><span class="arrow">›</span>`;
   button.onclick=()=>openQuarter(k,cat);menu.appendChild(button);
  }
  return;
 }
 const actions=$('#qActions'),create=document.createElement('button');create.type='button';create.className='widePrimary';
 create.textContent='＋ Создать выдел в квартале '+k+(selected!=null?' · КГЛФ '+selected:'');
 create.onclick=()=>openCompForm(k,selected);actions.appendChild(create);
 renderCompList($('#qComps'),scoped);
}
function renderCompList(box,rs){box.innerHTML='';[...rs].sort((a,b)=>+a.VD-+b.VD).forEach(r=>{const b=document.createElement('button');b.type='button';b.className='compCard';const cat=landName(r.KU)||'Категория не указана',sp=r.M3Pr?speciesName(r.M3Pr):'';b.innerHTML=`<span class="compNo">${esc(r.KV)}-${esc(r.VD)}</span><span class="compText"><b>Выдел ${esc(r.VD)}</b><small>${num(r.PLV)} га · ${esc(cat)}</small>${sp?`<small>Порода: ${esc(sp)}</small>`:''}</span><span class="arrow">›</span>`;b.onclick=()=>{current=r;renderComp();show('card')};const entry=document.createElement('div');entry.className='record-entry';const remove=document.createElement('button');remove.type='button';remove.className='record-delete';remove.innerHTML=SOLIN_DELETE_ICON;remove.title='Удалить выдел '+r.VD+' квартала '+r.KV;remove.setAttribute('aria-label',remove.title);remove.onclick=()=>openDeleteComp(r);entry.append(b,remove);box.appendChild(entry)})}
function renderAllComps(filter=''){const box=$('#allComps');if(!box)return;let rs=Object.values(D?.quarters||{}).flatMap(q=>q.compartments||[]);filter=filter.trim().toLowerCase();if(filter)rs=rs.filter(r=>String(r.KV).includes(filter)||String(r.VD).includes(filter));renderCompList(box,rs)}
function field(k,v){if(window.SolinHuman)return `<div class="humanField"><span>${esc(SolinHuman.label('ВыделВ',k))}</span><b>${esc(SolinHuman.value('ВыделВ',k,v,current))}</b></div>`;return `<div class="humanField"><span>${friendly[k]||k}</span><b>${esc(lookup(k,v))}</b></div>`}
function section(title,keys,o){const a=keys.filter(k=>o[k]!==undefined&&o[k]!==null&&o[k]!=='');return a.length?`<div class="humanSection"><h3>${title}</h3><div class="humanGrid">${a.map(k=>field(k,o[k])).join('')}</div></div>`:''}
function renderComp(){const r=current;$('#cardTitle').textContent=`Квартал ${r.KV} · Выдел ${r.VD}`;$('#cardSub').textContent=`${num(r.PLV)} га · ${landName(r.KU)||'категория не указана'}`;$('#humanContent').innerHTML=section('Основные сведения',['PLV','KU','KGLF','Fzona','OZU'],r)+section('Лесорастительные условия',['M3Pr','M3B','M3TL','M3TLU','M3G','M3KP'],r)+section('Проектируемые мероприятия',['M2PM1','M2Pr'],r)+section('Подрост',['PRkol','PRH','PRA'],r);const names=Object.keys(r._children||{});$('#childTabs').innerHTML=names.map((n,i)=>`<button class="chip ${i===0?'active':''}" onclick="renderChild('${n}',this)">${childNames[n]||n}</button>`).join('');$('#childContent').innerHTML='';if(names[0])renderChild(names[0],$('#childTabs button'))}
function renderChild(n,btn){$$('.chip').forEach(x=>x.classList.remove('active'));btn?.classList.add('active');const rs=current._children?.[n]||[];$('#childContent').innerHTML=`<div class="humanSection"><h3>${childNames[n]||n}</h3>${rs.map(r=>`<div class="humanGrid">${Object.entries(r).filter(([k,v])=>!['POS','LESN','KV','KGLF','VD'].includes(k)&&v!==null&&v!=='').map(([k,v])=>field(k,v)).join('')}</div>`).join('')||'<div class="empty">Нет данных</div>'}</div>`}
// Delete only from the active mobile working copy; the original imported MDB stays untouched.
function openDeleteQuarter(k){
 const q=D?.quarters?.[k],forestId=window.SolinWorkspace?.activeId;
 if(!q||!forestId)return toast('Квартал не найден в активном лесничестве');
 const stands=q.compartments?.length||0,categoryCount=new Set((q.quarterRows||[]).map(row=>String(row.KGLF??''))).size;
 openModal('Удаление квартала · 1 из 2',
  '<p>Удалить <b>квартал '+esc(k)+'</b> из мобильной рабочей базы?</p>'+
  '<p>Вместе с ним будут удалены <b>'+stands+' выделов</b> со всеми карточками и макетами'+(categoryCount>1?' по всем '+categoryCount+' категориям ГЛФ':'')+'.</p>'+
  '<div class="formActions"><button type="button" id="qDeleteCancel1">Отмена</button><button type="button" class="primary" id="qDeleteNext">Продолжить</button></div>');
 $('#qDeleteCancel1').onclick=closeModal;
 $('#qDeleteNext').onclick=()=>{
  if(D?.quarters?.[k]!==q||window.SolinWorkspace?.activeId!==forestId){closeModal();return toast('Квартал изменился — откройте его заново');}
  openModal('Удаление квартала · 2 из 2',
   '<p><b>Внимание!</b> Квартал <b>'+esc(k)+'</b> и все его <b>'+stands+' выделов</b> будут удалены из мобильной базы.</p>'+
   '<p class="import-warning">Отменить действие после удаления нельзя. Исходный импортированный MDB останется без изменений.</p>'+
   '<div class="formActions"><button type="button" id="qDeleteCancel2">Отмена</button><button type="button" class="delete-final" id="qDeleteFinal">Удалить навсегда</button></div><p class="delete-error" id="qDeleteError" role="alert"></p>');
  $('#qDeleteCancel2').onclick=closeModal;
  $('#qDeleteFinal').onclick=async()=>{
   const button=$('#qDeleteFinal');button.disabled=true;button.textContent='Удаление…';
   try{if(D?.quarters?.[k]!==q)throw Error('Квартал изменился — повторите операцию');await window.SolinWorkspace.deleteQuarter(k,forestId);closeModal();current=null;refresh();show('quartersScreen');toast('Квартал '+k+' удалён');}
   catch(e){const status=$('#qDeleteError');if(status)status.textContent='Не удалось удалить: '+e.message;button.disabled=false;button.textContent='Удалить навсегда';}
  };
 };
}
function openDeleteComp(r){
 const k=String(r.KV),q=D?.quarters?.[k],forestId=window.SolinWorkspace?.activeId;
 if(!q?.compartments?.includes(r)||!forestId)return toast('Выдел не найден в активном лесничестве');
 const address='квартал '+esc(k)+' · выдел '+esc(r.VD)+(r.KGLF!=null&&r.KGLF!==''?' · КГЛФ '+esc(r.KGLF):'');
 const wasQuarterOpen=!!document.querySelector('#qComps');
 openModal('Удаление выдела · 1 из 2',
  '<p>Удалить <b>'+address+'</b> из мобильной рабочей базы?</p>'+
  '<p>Будет удалена только эта карточка со всеми её макетами. Остальные выделы и квартал сохранятся.</p>'+
  '<div class="formActions"><button type="button" id="vDeleteCancel1">Отмена</button><button type="button" class="primary" id="vDeleteNext">Продолжить</button></div>');
 $('#vDeleteCancel1').onclick=closeModal;
 $('#vDeleteNext').onclick=()=>{
  if(D?.quarters?.[k]!==q||!q.compartments.includes(r)||window.SolinWorkspace?.activeId!==forestId){closeModal();return toast('Выдел изменился — откройте его заново');}
  openModal('Удаление выдела · 2 из 2',
   '<p><b>Внимание!</b> '+address+' и все связанные с ним макеты будут удалены из мобильной базы.</p>'+
   '<p class="import-warning">Отменить действие после удаления нельзя. Исходный импортированный MDB останется без изменений.</p>'+
   '<div class="formActions"><button type="button" id="vDeleteCancel2">Отмена</button><button type="button" class="delete-final" id="vDeleteFinal">Удалить навсегда</button></div><p class="delete-error" id="vDeleteError" role="alert"></p>');
  $('#vDeleteCancel2').onclick=closeModal;
  $('#vDeleteFinal').onclick=async()=>{
   const button=$('#vDeleteFinal');button.disabled=true;button.textContent='Удаление…';
   try{if(D?.quarters?.[k]!==q||!q.compartments.includes(r))throw Error('Выдел изменился — повторите операцию');await window.SolinWorkspace.deleteStand(r,forestId);closeModal();if(current===r)current=null;refresh();if(wasQuarterOpen&&D.quarters[k])openQuarter(k);toast('Выдел '+r.VD+' удалён');}
   catch(e){const status=$('#vDeleteError');if(status)status.textContent='Не удалось удалить: '+e.message;button.disabled=false;button.textContent='Удалить навсегда';}
  };
 };
}
function openQuarterForm(){const org=D.lesnichestvo?.[0]||{},source=D.source||{};
 openModal('Новый квартал',`<p class="quarter-address-info"><b>Лесовладелец:</b> ${esc(org.POS??'—')} · ${esc(org.NLX||'Не указан')}<br><b>Лесничество:</b> ${esc(org.LESN??'—')} · ${esc(org.NOS||'Не указано')}</p>
 <div class="formGrid">
 <label><span>Номер квартала</span><input id="newKV" inputmode="numeric" placeholder="Например, 91"></label>
 <label><span>Категория ГЛФ</span><input id="newKGLF" inputmode="numeric" placeholder="Выберите категорию"></label>
 <label><span>Функциональная зона</span><input id="newFzona" inputmode="numeric" placeholder="Выберите код"><small id="newFzonaHint" aria-live="polite"></small></label>
 <label><span>Административный район</span><input id="newRaion" inputmode="numeric" placeholder="Выберите код района"><small id="newRaionHint" aria-live="polite"></small></label>
 <label><span>Рельеф</span><select id="newRel"><option value="">— Не указано —</option><option value="1">1 — Равнинный</option><option value="2">2 — Горный</option></select></label>
 <label><span>Природная зона</span><input id="newKpz" inputmode="numeric" placeholder="Выберите природную зону"></label>
 <label><span>Лесохозяйственная зона</span><input id="newKlxr" inputmode="numeric" placeholder="По природной зоне"><small>Зависит от KTO лесничества, Kpz квартала и исходных Slxr/Szap.</small></label>
 <label><span>Доступность</span><input id="newDost" inputmode="numeric" placeholder="Код (2 — доступный)"></label>
 <label><span>Удалённость от дороги</span><input id="newUdal" inputmode="numeric" placeholder="Код (1 — до 10 км)"></label>
 <label><span>Год таксации</span><input id="newGodT" inputmode="numeric" value="${esc(org.GodT??'')}"></label>
 <label><span>Таксатор</span><input id="newTax" value="${esc(source.taxator||'')}"></label>
 <label><span>Площадь принял</span><input id="newPrin" placeholder="ФИО"></label>
 <label><span>Корректор</span><input id="newKorr" placeholder="ФИО"></label>
 </div><div class="formActions"><button class="secondary" onclick="closeModal()">Отмена</button><button class="primary" onclick="createQuarter()">Создать</button></div>`);
 const rules=window.SolinDependentRules;
 let kpzInput=$('#newKpz');
 for(const [field,selector] of [['KGLF','#newKGLF'],['Kpz','#newKpz']]){
  const el=$(selector),result=rules?.options('Квартал',field,{},null,D.lesnichestvo?.[0]);
  if(result?.status==='complete'){
   const filtered=rules.applySelect(el,result,{current:el.value});
   if(field==='Kpz'&&filtered)kpzInput=filtered;
  }else{
   const note=document.createElement('small');
   note.textContent=result?.reason||'Нет подтверждённого исходного справочника';
   el.parentElement?.append(note);
  }
 }
 // Native select fields work on iPhone; manual code is always available.
 const glfInput=$('#newKGLF'),choices=window.SolinQuarterPickers;
 const fzonaPicker=choices?.mount($('#newFzona'),'Fzona',()=>({KGLF:glfInput?.value}),
   {hint:$('#newFzonaHint'),scenario:'create'});
 choices?.mount($('#newRaion'),'Raion',()=>({KGLF:glfInput?.value}),
   {hint:$('#newRaionHint')});
 // Re-evaluate the original create-form predicate after KGLF changes.
 glfInput?.addEventListener('change',()=>fzonaPicker?.sync({value:fzonaPicker.value()}));
 glfInput?.addEventListener('input',()=>fzonaPicker?.sync({value:fzonaPicker.value()}));
 const zoneInput=$('#newKlxr');
 const hint=document.createElement('small');hint.setAttribute('aria-live','polite');
 zoneInput.parentElement.append(hint);
 let control=zoneInput;
 const refresh=()=>{
  const rules=window.SolinDependentRules;
  if(!rules)return;
  const result=rules.options('Квартал','Klxr',{Kpz:kpzInput.value},null,D.lesnichestvo?.[0]);
  if(!result)return;
  control=rules.applySelect(control,result,{current:control.value})||control;
  hint.textContent=result.reason;
 };
 kpzInput.addEventListener('input',refresh);
 kpzInput.addEventListener('change',refresh);
 refresh();
}
function createQuarter(){const raw=$('#newKV').value.trim();if(!/^\d+$/.test(raw)||Number(raw)<=0)return toast('Номер квартала должен быть положительным целым');const k=String(Number(raw));if(!k)return toast('Укажи номер квартала');if(D.quarters[k])return toast('Такой квартал уже есть');
 const fzona=window.SolinQuarterPickers?.value($('#newFzona'))??$('#newFzona').value;
 const raion=window.SolinQuarterPickers?.value($('#newRaion'))??$('#newRaion').value;
 for(const [field,value] of [['функциональной зоны',fzona],['административного района',raion]])
  if(value&&!/^\d+$/.test(value))return toast('Код '+field+' должен содержать только цифры');
 const districtCheck=window.SolinQuarterPickers?.validateDistrict?.(raion,D.lesnichestvo?.[0]);
 if(['invalid','mismatch'].includes(districtCheck?.status))
  return toast(districtCheck.reason);
 const checkZone=$('#newKlxr').value;
 const rules=window.SolinDependentRules;
 if(fzona!==''){
  const list=rules?.functionalZones({KGLF:$('#newKGLF').value},undefined,{scenario:'create'});
  if(!list||!['complete','empty'].includes(list.status)||rules.currentIsAllowed(fzona,list)!==true)
   return toast(list?.reason||'Выберите допустимую функциональную зону.');
 }
 for(const [field,value] of [['KGLF',$('#newKGLF').value],['Kpz',$('#newKpz').value],['Klxr',checkZone]]){
  if(!value)continue;
  const result=rules?.options('Квартал',field,{Kpz:$('#newKpz').value},null,D.lesnichestvo?.[0]);
  if(result&&result.status==='complete'&&rules.currentIsAllowed(value,result)===false)
   return toast('Недопустимый код '+field+'. Выберите значение из исходного справочника.');
  if(field==='Klxr'&&result?.status!=='complete')
   return toast(result?.reason||'Не удалось подтвердить лесохозяйственную зону.');
 }
 // Original desktop SOLI-N uses 0 for ordinary functional zones.
 // Categories 5, 7 and 10 require a category-specific code instead.
 const category=Number($('#newKGLF').value);
 if(fzona===''&&[5,7,10].includes(category))
  return toast('Выберите функциональную зону для категории ГЛФ '+category);
 const resolvedFzona=fzona===''?0:Number(fzona);
 D.quarters[k]={meta:{POS:D.lesnichestvo?.[0]?.POS,LESN:D.lesnichestvo?.[0]?.LESN,KV:+k||k,KGLF:$('#newKGLF').value||null,Kpz:$('#newKpz').value||null,Klxr:$('#newKlxr').value||null,
 Fzona:resolvedFzona,Raion:raion===''?null:Number(raion),Rel:$('#newRel').value||null,Dost:$('#newDost').value||null,Udal:$('#newUdal').value||null,GodT:$('#newGodT').value||D.lesnichestvo?.[0]?.GodT||null,Tax:$('#newTax').value.trim()||null,Prin:$('#newPrin').value.trim()||null,Korr:$('#newKorr').value.trim()||null},compartments:[],_local:true};saveLocal();closeModal();refresh();show('quartersScreen');toast('Квартал создан')}
function openCompForm(k='',selectedKGLF=null){if(!D?.quarters)return;const quarterIds=Object.keys(D.quarters).sort((a,b)=>+a-+b);if(!quarterIds.length)return toast('Сначала создайте квартал');if(!D.quarters[k])k=quarterIds[0];const opts=quarterIds.map(x=>`<option value="${esc(x)}" ${String(x)===String(k)?'selected':''}>Квартал ${esc(x)}</option>`).join('');const ku=Object.entries(D.fieldLookups?.KU||{}).filter(([c,n])=>c&&n).map(([c,n])=>`<option value="${esc(c)}">${esc(n)} · ${esc(c)}</option>`).join('');openModal('Новый выдел',`<div class="formGrid"><label><span>Квартал</span><select id="newCompKV" onchange="updateNewCompQuarter(this.value)">${opts}</select></label><label><span>Категория ГЛФ</span><select id="newCompKGLF">${(D.quarters[k]?.quarterRows||[D.quarters[k]?.meta||{}]).map(x=>`<option value="${esc(x.KGLF??'')}" ${selectedKGLF!=null&&String(x.KGLF)===String(selectedKGLF)?'selected':''}>${esc(x.KGLF)}</option>`).join('')}</select></label><label><span>Номер выдела</span><input id="newVD" inputmode="numeric" placeholder="Например, 12"></label><label><span>Площадь, га</span><input id="newPLV" inputmode="decimal" value="1.0" aria-describedby="newAreaHelp"><small id="newAreaHelp">Можно оставить 1.0 до переноса точных площадей: MapInfo → Excel → SOLI-N.</small></label><label><span>Категория угодий</span><select id="newKU"><option value="">Выбрать…</option>${ku}</select></label><label><span>Преобладающая порода</span><input id="newPOR" autocomplete="off" placeholder="Например, В или ОС"><small>Введите код или название. Бонитет рассчитается после макета 10.</small></label></div><div class="formActions"><button class="secondary" onclick="closeModal()">Отмена</button><button class="primary" onclick="createComp()">Создать</button></div>`);window.SolinSpeciesEntry?.mountAll?.();}
// The native iOS <select> is still finishing its change event here.
// Rebuilding the entire modal in that event can strand an invisible picker
// above the form, blocking every tap. Update only the dependent KGLF list.
function updateNewCompQuarter(k){
 const category=document.getElementById('newCompKGLF');
 const q=D?.quarters?.[k];
 if(!category||!q)return;
 const rows=q.quarterRows?.length?q.quarterRows:[q.meta||{}];
 const selected=category.value;
 const used=new Set();
 const options=[];
 for(const row of rows){
  const value=row.KGLF==null?'':String(row.KGLF);
  if(used.has(value))continue;
  used.add(value);
  options.push(new Option(value?'КГЛФ '+value:'Не указано',value));
 }
 category.replaceChildren(...options);
 if(options.some(o=>o.value===selected))category.value=selected;
}
function createComp(){const k=$('#newCompKV').value,vd=$('#newVD').value.trim(),pl=Number($('#newPLV').value.replace(',','.'));if(!k||!vd)return toast('Укажи квартал и выдел');if(!Number.isFinite(pl)||pl<=0)return toast('Проверь площадь');if(D.quarters[k].compartments.some(r=>Number(r.VD)===Number(vd)&&String(r.KGLF??'')===String($('#newCompKGLF')?.value??'')))return toast('Такой выдел уже есть');if(!/^\d+$/.test(vd)||Number(vd)<=0)return toast('Номер выдела должен быть положительным целым');if(!$('#newPOR')?.value&&document.querySelector('#newPOR__quick')?.value.trim())return toast('Выберите породу из подсказок: код или название');const source=(D.quarters[k].quarterRows||[]).find(q=>String(q.KGLF)===String($('#newCompKGLF')?.value))||D.quarters[k].meta||{};const r={POS:source.POS??D.lesnichestvo?.[0]?.POS,LESN:source.LESN??D.lesnichestvo?.[0]?.LESN,KGLF:source.KGLF??null,KV:+k||k,VD:+vd||vd,PLV:pl,KU:$('#newKU').value||null,M3Pr:$('#newPOR').value||null,M3B:0,_children:{},_local:true};window.SolinAddressContext?.enrichStand(r,D.quarters[k],D.lesnichestvo?.[0]);D.quarters[k].compartments.push(r);saveLocal();closeModal();refresh();show('quartersScreen');openQuarter(k);toast('Выдел создан')}
// A single modal root for every standard SOLI-N Field window. Keep it
// above fullscreen map/sheets; never recreate that root while an iOS
// native picker is active. The taxation card supplies its own close guard.
function openModal(t,html){
 const modal=$('#modal');
 if(!modal)return;
 $('#modalTitle').textContent=t;
 $('#modalBody').innerHTML=html;
 modal.classList.remove('hidden');
 modal.setAttribute('role','dialog');
 modal.setAttribute('aria-modal','true');
 modal.setAttribute('aria-labelledby','modalTitle');
 const x=modal.querySelector('.modalHead .close');
 if(x){x.type='button';x.setAttribute('aria-label','Закрыть окно');}
}
function closeModal(){
 const modal=$('#modal');
 if(!modal)return;
 // Blur the active native input before hiding, so iOS does not leave its
 // keyboard/select picker over the next dialog.
 if(modal.contains(document.activeElement))document.activeElement?.blur?.();
 modal.classList.add('hidden');
 modal.removeAttribute('role');
 modal.removeAttribute('aria-modal');
 modal.removeAttribute('aria-labelledby');
}
// V23: tapping outside the form never dismisses any editor.
// Escape is ignored here; the taxation card independently handles its dialogs.
document.addEventListener('keydown',event=>{
 const modal=$('#modal');
 if(event.key!=='Escape'||!modal||modal.classList.contains('hidden'))return;
 event.preventDefault();
 event.stopImmediatePropagation();
},true);
function toggleQuarterSearch(){$('#qSearch').classList.toggle('hidden')}function toggleCompSearch(){$('#vSearch').classList.toggle('hidden')}
function renderFriendlyRefs(q=''){q=q.trim().toLowerCase();const box=$('#friendlyRefs');if(!D)return;const wanted=Object.entries(refNames).filter(([code,name])=>!q||code.toLowerCase().includes(q)||name.toLowerCase().includes(q));box.innerHTML=wanted.map(([code,name])=>{const lookupKey=code==='SKU'?'KU':code==='SDP'?'POR':code==='SIAR'?'IAR':code==='SBon'?'M3B':code==='STB'?'TB':null;const rows=lookupKey?Object.entries(D.fieldLookups?.[lookupKey]||{}).filter(([c,n])=>c&&n):[];return `<details class="refCard"><summary><b>${name}</b><small>${rows.length?rows.length+' значений':'внутренний справочник SOLI-N'}</small></summary>${rows.length?`<div class="refRows">${rows.slice(0,250).map(([c,n])=>`<div class="refRow"><span class="refCode">${esc(c)}</span><span>${esc(n)}</span></div>`).join('')}</div>`:''}</details>`}).join('')}
function renderDb(){const box=$('#dbTables');if(!box||!D)return;box.innerHTML=Object.entries(D.transfSchema||{}).map(([n,cols])=>`<div class="dbRow"><b>${childNames[n]||n.replace('Макет','Макет ')}</b><small>${cols.length} полей</small></div>`).join('')}
async function locate(){toast('Ищу спутники GPS…');try{const p=await SolinLocation.current();gps={lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy};toast(`GPS: ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}`)}catch(e){toast(e.message)}}
function exportLocal(){const s=localStorage.getItem('solin_user_data_v1')||'{}';const blob=new Blob([s],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='solin-field-local.json';a.click();URL.revokeObjectURL(a.href);toast('Экспорт готов')}
window.addEventListener('DOMContentLoaded',()=>boot());if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
