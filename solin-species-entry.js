/* SOLI-N Field: keyboard-first species selection using original RowSource codes.
 * Uses the existing native select as the only stored value. No invented species.
 * В -> В (Вяз), ОС/ос -> ОС (Осина), with searchable fallback for every
 * original SDP / SDP_Tip species and explicit selection for ambiguous names. */
(()=>{'use strict';
 const mounted=new WeakMap(),strip=s=>String(s??'').trim().toLocaleUpperCase('ru-RU').replace(/Ё/g,'Е');
 let active=null;
 const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
 function entries(select){
  const names=window.SolinHuman?.lookup?.(select.dataset.ceForm||'ВыделВ',select.dataset.ceField||'M3Pr')||{};
  return [...select.options].filter(o=>o.value).map(o=>{
   const code=String(o.value);
   const displayed=String(o.textContent||'').trim();
   const label=names[code]||displayed.replace(new RegExp('^'+code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[—–-]\\s*'), '')||code;
   return {code,label:String(label).trim()};
  });
 }
 function candidates(select,query){
  const q=strip(query);
  if(!q)return entries(select).slice(0,14);
  const items=entries(select);
  const exact=items.filter(x=>strip(x.code)===q);
  const starts=items.filter(x=>strip(x.code).startsWith(q)&&strip(x.code)!==q);
  const nameStarts=items.filter(x=>strip(x.label).startsWith(q)&&!exact.includes(x)&&!starts.includes(x));
  const other=items.filter(x=>strip(x.label).includes(q)&&!exact.includes(x)&&!starts.includes(x)&&!nameStarts.includes(x));
  return [...exact,...starts,...nameStarts,...other].slice(0,30);
 }
 function auto(select,query){
  const q=strip(query),items=entries(select);
  if(!q)return null;
  const exact=items.find(x=>strip(x.code)===q);
  if(exact)return exact;
  const exactName=items.filter(x=>strip(x.label)===q);
  if(exactName.length===1)return exactName[0];
  const prefix=items.filter(x=>strip(x.code).startsWith(q)||strip(x.label).startsWith(q));
  return prefix.length===1?prefix[0]:null;
 }
 function hide(){
  if(active?.popup){active.popup.remove();active.input.setAttribute('aria-expanded','false');active.popup=null;}
  document.getElementById('modal')?.classList.remove('solin-species-open');
  active=null;
 }
 function syncUI(state){
  if(document.activeElement===state.input)return;
  const found=entries(state.select).find(x=>String(x.code)===String(state.select.value));
  state.input.value=found?found.code+' — '+found.label:(state.select.value||'');
 }
 function commit(state,item,final=false){
  const value=item?.code||'';
  if(state.select.value!==value){
   state.select.value=value;
   state.select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  state.input.dataset.speciesCommitted=value;
  if(final)state.input.value=item?item.code+' — '+item.label:'';
  state.input.setCustomValidity('');
  state.input.removeAttribute('aria-invalid');
 }
 // Keep suggestions in the SAME layout as the input. iOS Safari moves
 // the visual viewport separately when the keyboard opens; a fixed overlay
 // attached to document.body can jump above the field despite a correct top.
 function visualBottom(){
  const viewport=window.visualViewport;
  return (viewport?.offsetTop||0)+(viewport?.height||innerHeight);
 }
 function findScroller(input){
  for(let parent=input.parentElement;parent;parent=parent.parentElement){
   const style=window.getComputedStyle(parent);
   if(/auto|scroll/.test(style.overflowY)&&parent.scrollHeight>parent.clientHeight+2)
    return parent;
  }
  return null;
 }
 function ensureRoom(state){
  if(!state.popup||state.mode!=='inline'||document.activeElement!==state.input)return;
  const input=state.input.getBoundingClientRect(),available=visualBottom()-input.bottom-8;
  // Scroll the form (never the page) to keep the beginning of the downward
  // list visible. The list is a real sibling of the input and always follows it.
  if(available>=140)return;
  const scroller=findScroller(state.input);
  if(!scroller)return;
  scroller.scrollTop+=Math.min(210,Math.max(0,Math.ceil(155-available)));
 }
 function movePopup(state){
  if(!state.popup||!state.input.isConnected){
   if(!state.input.isConnected)hide();
   return;
  }
  // Normal field: NO positioning. Its list is in normal document flow.
  if(state.mode!=='card')return;
  // The classic Maket10 board is fixed-size and its table clips children.
  // Anchor the list to the board (not to the visual viewport or body).
  // It travels with the whole card when the user scrolls/pans/zooms.
  const board=state.board,rect=board.getBoundingClientRect(),
   field=state.input.getBoundingClientRect(),
   scale=rect.width/(board.offsetWidth||1200)||1,
   width=Math.max(180,Math.min(340,field.width/scale)),
   left=Math.max(0,Math.min((field.left-rect.left)/scale,board.offsetWidth-width-4));
  state.popup.style.left=left+'px';
  state.popup.style.top=(field.bottom-rect.top)/scale+3+'px';
  state.popup.style.width=width+'px';
 }
 function show(state){
  if(active&&active!==state)hide();
  const q=state.input.value.includes(' — ')?state.select.value:state.input.value;
  const items=candidates(state.select,q);
  if(!items.length){if(active===state)hide();return;}
  // Reuse the SAME list element between keystrokes. Removing a large block
  // and immediately re-inserting it makes iOS scroll the focused field.
  let popup=state.popup;
  if(!popup){
   popup=document.createElement('div');
   popup.className='solin-species-results';
   popup.id=state.input.id+'-suggestions';
   popup.setAttribute('role','listbox');
   state.popup=popup;
   const board=state.input.closest('.dt-board');
   state.mode=board?'card':'inline';state.board=board;
   if(board){
    popup.classList.add('solin-species-results-card');
    board.appendChild(popup);
   }else{
    popup.classList.add('solin-species-results-inline');
    state.input.insertAdjacentElement('afterend',popup);
   }
   popup.addEventListener('pointerdown',e=>e.preventDefault());
   popup.addEventListener('click',e=>{
    const option=e.target.closest('[data-species-index]');
    if(!option||!state.items)return;
    const item=state.items[Number(option.dataset.speciesIndex)];
    if(!item)return;
    commit(state,item,true);hide();state.input.focus();state.input.select();
   });
  }
  state.items=items;
  state.index=0;
  active=state;
  popup.innerHTML=items.map((item,i)=>'<div class="solin-species-option" role="option" tabindex="-1" data-species-index="'+i+'" aria-selected="'+(i===0?'true':'false')+'">'+
   h(item.code+' — '+item.label)+'</div>').join('');
  state.input.setAttribute('aria-expanded','true');
  document.getElementById('modal')?.classList.add('solin-species-open');
  movePopup(state);
 }
 function mount(select){
  if(!select||select.tagName!=='SELECT'||!select.isConnected)return null;
  if(mounted.has(select)){syncUI(mounted.get(select));return mounted.get(select);}
  const input=document.createElement('input');
  input.type='text';input.id=(select.id||'species')+'__quick';
  input.className='solin-species-query';input.autocomplete='off';input.spellcheck=false;
  input.placeholder='Код породы: В, ОС…';input.setAttribute('aria-label','Быстрый ввод породы по коду или названию');
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',input.id+'-suggestions');
  select.classList.add('solin-species-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  // iPhone Safari: an implicit <label> can activate a hidden SELECT rather
  // than the visible INPUT. Keep the SELECT only for codes and events,
  // outside the label, so a tap opens the keyboard (not the native wheel).
  const owner=select.closest('label');
  select.before(input);
  if(owner){owner.htmlFor=input.id;owner.after(select);}
  const state={select,input,popup:null,items:[],index:0};mounted.set(select,state);syncUI(state);
  input.addEventListener('focus',()=>{
   const found=entries(select).find(x=>x.code===select.value);
   if(found){input.value=found.code;input.select();}
   show(state);
   requestAnimationFrame(()=>{if(active===state)ensureRoom(state);});
   // Keyboard appearance can change the visible area after focus. The list
   // stays below by construction; only the form scroll position is adjusted.
   setTimeout(()=>{if(active===state)ensureRoom(state);},240);
  });
  input.addEventListener('input',()=>{
   const query=input.value;
   const best=auto(select,query);
   commit(state,best,false);show(state);
  });
  input.addEventListener('keydown',e=>{
   if(e.key==='Escape'){hide();e.stopPropagation();return;}
   if((e.key==='ArrowDown'||e.key==='ArrowUp')&&active===state&&state.items.length){
    e.preventDefault();const delta=e.key==='ArrowDown'?1:-1;state.index=(state.index+delta+state.items.length)%state.items.length;
    for(const node of state.popup.querySelectorAll('[data-species-index]'))node.setAttribute('aria-selected',String(Number(node.dataset.speciesIndex)===state.index));
    state.popup.querySelector('[data-species-index="'+state.index+'"]')?.scrollIntoView({block:'nearest'});return;
   }
   if(e.key==='Enter'){
    const item=active===state?state.items[state.index]:auto(select,input.value);
    if(item){e.preventDefault();commit(state,item,true);hide();input.select();}
   }
  });
  input.addEventListener('blur',()=>{
   // A click in the fixed suggestion panel retains focus until its handler.
   queueMicrotask(()=>{if(document.activeElement!==input){syncUI(state);if(active===state)hide();}});
  });
  select.addEventListener('change',()=>{if(document.activeElement!==input)syncUI(state);});
  return state;
 }
 function mountAll(root=document){
  const selector='#newPOR, #modalBody select[data-wffield="POR"], #modalBody select[data-wffield="M3Pr"], #ce-form select[data-ce-scope="base"][data-ce-field="M3Pr"], #ce-form select[data-ce-scope="Макет10"][data-ce-field="POR"]';
  for(const sel of root.querySelectorAll(selector))mount(sel);
 }
 // Inline entries do not need viewport geometry recalculation; the fixed
 // classic Maket10 board does need alignment when its zoom changes.
 document.addEventListener('scroll',()=>{if(active)movePopup(active);},true);
 window.addEventListener('resize',()=>{if(active){movePopup(active);ensureRoom(active);}});
 window.visualViewport?.addEventListener('resize',()=>{if(active)ensureRoom(active);});
 document.addEventListener('pointerdown',e=>{if(active&&!active.popup.contains(e.target)&&e.target!==active.input)hide();},true);
 window.SolinSpeciesEntry={mount,mountAll};
})();
