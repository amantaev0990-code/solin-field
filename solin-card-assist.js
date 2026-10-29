/* Mobile ergonomics for the original 1200x704 SOLI-N taxation sheet.
 * The original field controls and draft/save flow remain the only data source. */
(()=>{'use strict';
 const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const mobile=()=>window.matchMedia('(max-width:700px)').matches;
 let state=null;
 function board(){return document.querySelector('.ce-modal #ce-form .dt-board');}
 function host(){return document.querySelector('.ce-modal .modalCard');}
 function layer(){const parent=host();if(!parent)return null;let el=parent.querySelector('#ce-assist');if(!el){el=document.createElement('div');el.id='ce-assist';el.className='ce-assist-overlay';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Удобное редактирование карточки');parent.append(el);}return el;}
 function mount(title,body,back){const el=layer();if(!el)return;el.hidden=false;el.innerHTML='<div class="ce-assist-panel"><header class="ce-assist-head"><button type="button" data-ce-assist-back aria-label="Назад">‹</button><strong>'+h(title)+'</strong><button type="button" data-ce-assist-close aria-label="Закрыть">×</button></header><div class="ce-assist-content">'+body+'</div></div>';el.dataset.back=back?'1':'0';}
 function dismiss(){const el=document.getElementById('ce-assist');if(el){el.hidden=true;el.replaceChildren();}state=null;}
 function fieldLabel(el){return el.getAttribute('aria-label')||el.dataset.ceField||'Поле';}
 function locationName(el){const group=el.closest('[id^="ce-section-"]');if(group)return 'Макет '+group.id.replace('ce-section-','');return el.dataset.ceScope==='quarter'?'Квартал':'Карточка таксации';}
 function findElements(){return [...(board()?.querySelectorAll('[data-ce-field]')||[])].filter(el=>!el.closest('.ce-other')&&!el.closest('#ce-extra'));}
 function findRow(index){return board()?.querySelectorAll('#ce-table-Макет10 tbody tr')[index]||null;}
 function currentRow(){const rows=[...(board()?.querySelectorAll('#ce-table-Макет10 tbody tr')||[])];return Math.max(0,rows.findIndex(x=>x.classList.contains('dt-selected')));}
 function editField(el,returnRow=null){if(!el||!el.isConnected)return;const list=el.tagName==='SELECT'?[...el.options].map(o=>({value:o.value,name:o.value===''?'Не указано':SolinHuman.value(el.dataset.ceForm,el.dataset.ceField,o.value)})):null;state={mode:'field',el,returnRow,list};
  const caption=locationName(el)+' · '+fieldLabel(el);
  if(list){mount(caption,'<p class="ce-assist-tip">Найдите значение по шифру или названию. Исходный код сохранится без изменения.</p><label class="ce-assist-searchlabel">Поиск по коду или названию<input id="ce-assist-query" type="search" autocomplete="off" placeholder="Например: 22 или пастбище"></label><div id="ce-assist-options" class="ce-assist-options" role="listbox"></div>',returnRow!=null);filterOptions('');}
  else{const val=el.value,mode=el.inputMode==='decimal'?'decimal':'text';mount(caption,'<p class="ce-assist-tip">Редактируется то же поле, что и на настольной карточке.</p><label class="ce-assist-searchlabel">'+h(fieldLabel(el))+'<input id="ce-assist-value" type="text" inputmode="'+mode+'" autocomplete="off" value="'+h(val)+'"></label><div class="ce-assist-error" id="ce-assist-error" role="alert"></div><div class="ce-assist-actions"><button type="button" data-ce-assist-apply>Применить</button></div>',!!returnRow);}
 }
 function filterOptions(query){if(!state||state.mode!=='field'||!state.list)return;const q=String(query).toLocaleLowerCase('ru-RU').trim();let matches=state.list.map((x,i)=>({...x,i})).filter(x=>!q||x.value.toLocaleLowerCase('ru-RU').includes(q)||x.name.toLocaleLowerCase('ru-RU').includes(q));const total=matches.length;matches=matches.slice(0,80);const parent=document.querySelector('#ce-assist-options');if(!parent)return;parent.innerHTML=matches.map(o=>'<button type="button" role="option" class="ce-assist-option" data-ce-assist-option="'+o.i+'" aria-selected="'+(o.value===state.el.value)+'"><b>'+h(o.value||'—')+'</b><span>'+h(o.name)+'</span></button>').join('')+(total>80?'<p class="ce-assist-tip">Показаны первые 80 из '+total+'. Уточните поиск.</p>':'')+(!total?'<p class="ce-assist-tip">Совпадений нет. Попробуйте другой шифр или название.</p>':'');}
 function finishField(value){const s=state;if(!s||s.mode!=='field'||!s.el.isConnected)return;const el=s.el;el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));if(el.getAttribute('aria-invalid')==='true'){const message=document.querySelector('#ce-assist-error');if(message)message.textContent=el.validationMessage||'Проверьте значение';else{const tip=document.querySelector('.ce-assist-tip');if(tip)tip.textContent=el.validationMessage||'Проверьте значение';}return;}if(s.returnRow!=null)editRow(s.returnRow);else dismiss();}
 function editRow(index){const tr=findRow(index);if(!tr)return;const cols=[...tr.querySelectorAll('[data-ce-field]')];state={mode:'row',index,cols};const body='<p class="ce-assist-tip">Изменяйте поля строки крупными кнопками. Изменения попадут в карточку; окончательное сохранение — «Сохранить» или «Выход».</p><div class="ce-assist-row-grid">'+cols.map((el,i)=>{const val=el.value;const name=el.tagName==='SELECT'&&val?SolinHuman.value(el.dataset.ceForm,el.dataset.ceField,val):val||'Не указано';return '<button type="button" class="ce-assist-row-field" data-ce-assist-row-field="'+i+'"><small>'+h(fieldLabel(el))+'</small><b>'+h(val||'—')+'</b><span>'+h(name)+'</span></button>';}).join('')+'</div><div class="ce-assist-actions"><button type="button" data-ce-assist-done>Готово</button></div>';mount('Макет 10 · строка '+(index+1),body,false);}
 function editSelectedRow(){editRow(currentRow());}
 function editPicker(){const fields=findElements();state={mode:'picker',fields};mount('Найти поле карточки','<p class="ce-assist-tip">Выберите поле по названию, шифру или макету. Расположение настольной карточки не меняется.</p><label class="ce-assist-searchlabel">Поиск<input id="ce-assist-query" type="search" autocomplete="off" placeholder="Площадь, порода, макет 31…"></label><div id="ce-assist-options" class="ce-assist-options"></div>',false);filterPicker('');}
 function filterPicker(query){if(state?.mode!=='picker')return;const q=String(query).toLocaleLowerCase('ru-RU').trim();const data=state.fields.map((el,i)=>({el,i,caption:fieldLabel(el),section:locationName(el)})).filter(x=>!q||[x.caption,x.el.dataset.ceField,x.section].some(s=>s.toLocaleLowerCase('ru-RU').includes(q))).slice(0,100);const target=document.querySelector('#ce-assist-options');if(target)target.innerHTML=data.map(x=>'<button type="button" class="ce-assist-option" data-ce-assist-pick="'+x.i+'"><b>'+h(x.section)+'</b><span>'+h(x.caption)+' · '+h(x.el.dataset.ceField)+'</span></button>').join('')+(!data.length?'<p class="ce-assist-tip">Поле не найдено.</p>':'');}
 function editMaketPicker(){
  const base=[[1,'Условия участка'],[2,'Хозяйственные мероприятия'],
    [3,'Лесорастительная характеристика'],[4,'Захламлённость и сухостой'],
    [5,'Возраст и запас'],[10,'Таксационная характеристика древостоя'],
    [31,'Подрост'],[32,'Подлесок']];
  const extras=[11,12,13,14,15,16,17,19,20,21,23,25,27,28]
    .map(n=>[n,SolinHuman.formName('Макет'+n)]);
  state={mode:'makets',items:[...base,...extras].sort((a,b)=>a[0]-b[0])};
  mount('Макеты карточки',
    '<p class="ce-assist-tip">Откройте нужный макет по номеру или названию. Данные выбранного лесничества не изменяются.</p>'+
    '<label class="ce-assist-searchlabel">Поиск макета<input id="ce-assist-query" type="search" autocomplete="off" placeholder="Например: 28, транспорт"></label>'+
    '<div id="ce-assist-options" class="ce-assist-options"></div>',false);
  filterMakets('');
 }
 function filterMakets(query){
  if(state?.mode!=='makets')return;
  const q=String(query).toLocaleLowerCase('ru-RU').trim();
  const results=state.items.filter(([number,name])=>!q||String(number).includes(q)||
    String(name).toLocaleLowerCase('ru-RU').includes(q));
  const root=document.querySelector('#ce-assist-options');
  if(!root)return;
  root.innerHTML=results.map(([number,name])=>
    '<button type="button" class="ce-assist-option" data-ce-assist-maket="'+number+'">'+
    '<b>Макет '+number+'</b><span>'+h(name)+'</span></button>').join('')+
    (!results.length?'<p class="ce-assist-tip">Макет не найден.</p>':'');
 }
 function enhance(){const b=board();if(!b||!document.querySelector('.ce-modal #ce-form'))return;const toolbar=document.querySelector('.ce-modal .dt-toolbar');if(toolbar&&!toolbar.querySelector('.ce-assist-shortcuts')){const node=document.createElement('div');node.className='ce-assist-shortcuts';node.innerHTML='<button type="button" data-ce-assist-find>⌕ Найти поле</button><button type="button" data-ce-assist-row>▦ Древостой</button><button type="button" data-ce-assist-makets>Макеты</button>';toolbar.insertBefore(node,toolbar.querySelector('.dt-tools'));}
  if(!document.querySelector('.ce-mobile-tabs')){const nav=document.createElement('nav');nav.className='ce-mobile-tabs';nav.setAttribute('aria-label','Макеты карточки');nav.innerHTML=[['main','Карточка'],...[1,2,3,4,5,10,31,32].map(n=>[String(n),'М'+n])].map(([id,label])=>'<button type="button" data-ce-jump="'+id+'">'+label+'</button>').join('');nav.insertAdjacentHTML('beforeend',[11,12,13,14,15,16,17,19,20,21,23,25,27,28].map(n=>'<button type="button" data-ce-mobile-extra="Макет'+n+'" title="'+h(SolinHuman.formName('Макет'+n))+'">М'+n+'</button>').join(''));toolbar.after(nav);}
 }
 function back(){if(state?.mode==='field'&&state.returnRow!=null)editRow(state.returnRow);else dismiss();}
 function overlayAction(e){const target=e.target.closest('button');if(!target)return;
  if(target.hasAttribute('data-ce-assist-close')||target.hasAttribute('data-ce-assist-done')){dismiss();return;}
  if(target.hasAttribute('data-ce-assist-back')){back();return;}
  if(target.hasAttribute('data-ce-assist-apply')){finishField(document.querySelector('#ce-assist-value')?.value??'');return;}
  if(target.hasAttribute('data-ce-assist-option')){const option=state?.list?.[Number(target.dataset.ceAssistOption)];if(option)finishField(option.value);return;}
  if(target.hasAttribute('data-ce-assist-row-field')){const i=Number(target.dataset.ceAssistRowField),s=state;if(s?.mode==='row')editField(s.cols[i],s.index);return;}
  if(target.hasAttribute('data-ce-assist-pick')){const el=state?.fields?.[Number(target.dataset.ceAssistPick)];if(el)editField(el);return;}
  if(target.hasAttribute('data-ce-assist-maket')){
    const number=target.dataset.ceAssistMaket;
    dismiss();
    const mobileTab=document.querySelector('.ce-mobile-tabs [data-ce-jump="'+number+'"],.ce-mobile-tabs [data-ce-mobile-extra="Макет'+number+'"]');
    if(mobileTab)mobileTab.click();
    return;
  }
 }
 document.addEventListener('pointerdown',e=>{if(!mobile()||!board()||!e.target?.closest)return;const el=e.target.closest('.dt-board select[data-ce-field]');if(!el||el.disabled||el.readOnly||!host()||layer()?.hidden===false)return;e.preventDefault();e.stopPropagation();editField(el);},true);
 document.addEventListener('click',e=>{if(!document.querySelector('.ce-modal'))return;const lay=layer();if(lay&&!lay.hidden&&lay.contains(e.target)){overlayAction(e);return;}
  const shortcut=e.target.closest?.('[data-ce-assist-find],[data-ce-assist-row],[data-ce-assist-makets]');if(shortcut&&mobile()){e.preventDefault();e.stopPropagation();if(shortcut.hasAttribute('data-ce-assist-find'))editPicker();else if(shortcut.hasAttribute('data-ce-assist-makets'))editMaketPicker();else editSelectedRow();return;}
  const extra=e.target.closest?.('[data-ce-mobile-extra]');if(extra){
   const direct=document.querySelector('.dt-footer [data-ce-extra="'+extra.dataset.ceMobileExtra+'"]');
   if(direct)direct.click();
   else{
     const select=document.querySelector('.dt-maket-select');
     if(select){select.value=extra.dataset.ceMobileExtra.replace('Макет','');select.dispatchEvent(new Event('change',{bubbles:true}));}
   }
   return;
  }
  const jump=e.target.closest?.('[data-ce-jump]');if(jump){const id=jump.dataset.ceJump;document.querySelectorAll('.ce-mobile-tabs button').forEach(b=>{if(b===jump)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});document.querySelector('#ce-extra').hidden=true;document.querySelector('#ce-action-panel').hidden=true;document.querySelector(id==='main'?'.dt-header':'#ce-section-'+id)?.scrollIntoView({block:'start'});return;}
  const el=e.target.closest?.('.dt-board select[data-ce-field]');if(el&&mobile()&&lay?.hidden!==false){e.preventDefault();e.stopPropagation();editField(el);}},true);
 document.addEventListener('input',e=>{if(e.target?.id==='ce-assist-query'){if(state?.mode==='picker')filterPicker(e.target.value);else if(state?.mode==='makets')filterMakets(e.target.value);else filterOptions(e.target.value);}},true);
 document.addEventListener('keydown',e=>{const lay=document.querySelector('#ce-assist');if(!lay||lay.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();back();}if(e.key==='Enter'&&e.target?.id==='ce-assist-value'){e.preventDefault();finishField(e.target.value);}},true);
 const observer=new MutationObserver(()=>{enhance();const lay=document.querySelector('#ce-assist');if(lay&&!document.querySelector('.ce-modal'))dismiss();});observer.observe(document.getElementById('modal')||document.body,{subtree:true,childList:true});
 enhance();
 window.SolinCardAssist={openFieldPicker:editPicker,openRowEditor:editSelectedRow};
})();
