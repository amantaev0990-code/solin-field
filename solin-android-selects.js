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
 // WebView opens a native picker before the click default on some tablets.
 // For touch input use the complete touch sequence. Cancelling a touch
 // pointerdown may issue pointercancel instead of pointerup, so depending on
 // pointerup alone would leave the custom picker permanently closed.
 let pending=null,tapSerial=0;
 const targetSelect=e=>{
  const t=e.target;
  const direct=t?.closest?.('select');
  if(direct)return direct;
  const label=t?.closest?.('label');
  if(!label||t?.closest?.('button,input,textarea'))return null;
  const options=[...label.querySelectorAll('select')].filter(ordinary);
  return options.length===1?options[0]:null;
 };
 function swallow(e){
  if(e.cancelable)e.preventDefault();
  e.stopImmediatePropagation();
 }
 function queueOpen(select,serial){
  // Never place a sheet under an active touch; the trailing click could
  // hit its backdrop and close it again in the same gesture.
  setTimeout(()=>{
   if(serial!==tapSerial)return;
   pending=null;
   if(ordinary(select))open(select);
  },0);
 }
 function onTouchStart(e){
  const select=targetSelect(e);
  if(!ordinary(select))return;
  swallow(e);
  pending={select,kind:'touch',serial:++tapSerial};
 }
 function onTouchEnd(e){
  if(pending?.kind!=='touch')return;
  const {select,serial}=pending;swallow(e);queueOpen(select,serial);
 }
 function onTouchCancel(e){
  if(pending?.kind==='touch'){pending=null;tapSerial++;}
 }
 function onPointerDown(e){
  if(e.pointerType==='touch')return; // handled by touchstart/end
  const select=targetSelect(e);
  if(!ordinary(select))return;
  swallow(e);
  pending={select,id:e.pointerId,kind:'pointer',serial:++tapSerial};
 }
 function onPointerUp(e){
  if(pending?.kind!=='pointer'||pending.id!==e.pointerId)return;
  const {select,serial}=pending;swallow(e);queueOpen(select,serial);
 }
 function onPointerCancel(e){
  if(pending?.kind==='pointer'&&pending.id===e.pointerId){
   pending=null;tapSerial++;
  }
 }
 function onClick(e){
  const select=targetSelect(e);
  if(!ordinary(select))return;
  swallow(e);
  if(pending?.select===select)return;
  // Accessibility and keyboard activation do not necessarily send
  // pointer/touch events but should use the same custom list.
  queueOpen(select,++tapSerial);
 }
 window.addEventListener('touchstart',onTouchStart,{capture:true,passive:false});
 window.addEventListener('touchend',onTouchEnd,{capture:true,passive:false});
 window.addEventListener('touchcancel',onTouchCancel,true);
 window.addEventListener('pointerdown',onPointerDown,true);
 window.addEventListener('pointerup',onPointerUp,true);
 window.addEventListener('pointercancel',onPointerCancel,true);
 window.addEventListener('click',onClick,true);
 window.SolinAndroidSelects={open,close:cleanup};
})();
