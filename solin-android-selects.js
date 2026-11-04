/* Android-only accessible picker for ordinary SOLI-N SELECT controls.
 * Keeps the EXACT original form/select/data model and MDB code values.
 * The desktop-like tax card uses SolinCardAssist instead.
 * Fixes native Android picker wheel without keyboard/search on tablets. */
(()=>{'use strict';
 if(!window.Capacitor?.isNativePlatform?.()||window.Capacitor?.getPlatform?.()!=='android')return;
 const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let overlay=null,selection=null,values=[],query='',previousFocus=null;
 const dom=()=>document.querySelector('#solin-android-picker');
 const viewport=()=>{
  if(!overlay)return;
  const view=window.visualViewport;
  overlay.style.setProperty('--sap-height',(view?.height||window.innerHeight)+'px');
  overlay.style.setProperty('--sap-top',(view?.offsetTop||0)+'px');
 };
 window.visualViewport?.addEventListener('resize',viewport);
 window.visualViewport?.addEventListener('scroll',viewport);
 const visible=el=>{
  if(!el?.isConnected||el.closest('[hidden]')||el.classList.contains('solin-species-native'))return false;
  const rect=el.getBoundingClientRect(),s=getComputedStyle(el);
  return rect.width>=15&&rect.height>=15&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0.04;
 };
 const ordinary=select=>select instanceof HTMLSelectElement&&
  // These controls use the dedicated searchable original-card editor.
  !select.closest('.ce-modal #ce-form .dt-board')&&visible(select);
 function cleanup(restoreFocus=false){
  if(!overlay)return;
  if(document.activeElement?.closest?.('#solin-android-picker'))document.activeElement.blur();
  overlay.remove();overlay=null;selection=null;values=[];
  document.removeEventListener('keydown',onKey,true);
  if(restoreFocus&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  previousFocus=null;
 }
 function label(select){
  const explicit=select.getAttribute('aria-label')||select.labels?.[0]?.textContent;
  return String(explicit||select.closest('label')?.querySelector('span')?.textContent||select.id||'Выберите значение').trim().slice(0,140);
 }
 function draw(){
  if(!overlay||!selection?.isConnected){cleanup();return;}
  const box=overlay.querySelector('#sap-options'),needle=query.trim().toLocaleLowerCase('ru-RU');
  let found=values.filter(x=>!needle||x.text.toLocaleLowerCase('ru-RU').includes(needle)||x.value.toLocaleLowerCase('ru-RU').includes(needle));
  const count=found.length;found=found.slice(0,150);
  box.innerHTML=found.map(x=>'<button type="button" class="sap-option" data-sap-index="'+x.idx+'" aria-selected="'+(x.value===selection.value)+'"><b>'+h(x.text)+'</b></button>').join('')+
   (!count?'<p class="sap-help">Нет совпадений. Измените запрос или заполните связанные поля.</p>':
    count>150?'<p class="sap-help">Показаны первые 150 из '+count+'. Уточните запрос.</p>':'');
  overlay.querySelector('#sap-count').textContent=count+' вариантов';
 }
 function choose(index){
  const item=values.find(v=>v.idx===index);
  if(!item||item.disabled||!selection?.isConnected)return;
  const select=selection,changed=select.value!==item.value;
  cleanup(false);
  if(changed){
   select.value=item.value;
   select.dispatchEvent(new Event('input',{bubbles:true}));
   select.dispatchEvent(new Event('change',{bubbles:true}));
  }
 }
 function onKey(e){if(e.key==='Escape'&&overlay){e.preventDefault();e.stopImmediatePropagation();cleanup();}}
 function open(select){
  if(!ordinary(select))return;
  cleanup(false);
  selection=select;previousFocus=document.activeElement;
  values=[...select.options].map((o,i)=>({idx:i,value:o.value,text:o.textContent?.trim()||o.value,disabled:o.disabled})).filter(o=>!o.disabled);
  overlay=document.createElement('div');overlay.id='solin-android-picker';overlay.className='solin-android-picker';
  const disabled=select.disabled;
  const reason=select.title||select.dataset.dependentStatus||'';
  overlay.innerHTML='<div class="sap-backdrop"></div><section class="sap-sheet" role="dialog" aria-modal="true" aria-label="'+h(label(select))+'">'+
   '<header class="sap-head"><b>'+h(label(select))+'</b><button type="button" class="sap-close">Закрыть</button></header>'+
   (disabled?'<p class="sap-help">Поле пока недоступно. '+h(reason||'Проверьте связанные значения карточки и загрузку справочников.')+'</p>':
    '<input id="sap-search" type="search" autocomplete="off" spellcheck="false" placeholder="Введите код или название…" aria-label="Поиск по коду или названию">')+
   '<div id="sap-count" class="sap-count"></div><div id="sap-options" class="sap-options" role="listbox"></div></section>';
  document.body.append(overlay);
  viewport();
  overlay.querySelector('.sap-close').onclick=()=>cleanup(false);
  overlay.querySelector('.sap-backdrop').onclick=()=>cleanup(false);
  overlay.querySelector('.sap-options').addEventListener('click',e=>{
   const button=e.target.closest('[data-sap-index]');
   if(button)choose(Number(button.dataset.sapIndex));
  });
  const input=overlay.querySelector('#sap-search');
  if(input){
   input.oninput=()=>{query=input.value;draw();};
   query='';draw();
   // Called synchronously from a genuine touch event on Android WebView.
   // Small lists are immediately tappable. Focusing search on every tap
   // forced the keyboard over the choices on landscape Android tablets.
   // The user can still tap search whenever it is useful.
   // Search is opt-in for ALL lists, including the region list.
   // Android IME opens only when the user taps this input.
  }else{query='';draw();}
  document.addEventListener('keydown',onKey,true);
 }
 function hit(e){
  const select=e.target?.closest?.('select');
  if(!ordinary(select))return;
  // Prevent Android's own picker; show the same codes in a searchable
  // panel with a real keyboard. Card editor controls use SolinCardAssist.
  e.preventDefault();e.stopImmediatePropagation();open(select);
 }
 // Open after the tap is complete, not on pointerdown: on a physical
 // Android tablet, creating the sheet under the same touch lets the
 // ensuing pointerup/click land on its backdrop and immediately close it.
 // Capturing click also cancels the native HTML select popup.
 window.addEventListener('click',hit,true);
 window.SolinAndroidSelects={open,close:cleanup};
})();
