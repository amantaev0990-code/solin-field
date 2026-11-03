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
 // iPhone Safari shrinks visualViewport when the keyboard appears.
 // Suggestions MUST remain below the entry field; never flip above it.
 function visibleFrame(){
  const v=window.visualViewport;
  return {top:v?.offsetTop||0,left:v?.offsetLeft||0,
   width:v?.width||innerWidth,height:v?.height||innerHeight};
 }
 function findScroller(input){
  for(let p=input.parentElement;p;p=p.parentElement){
   const style=window.getComputedStyle(p);
   if(/auto|scroll/.test(style.overflowY)&&p.scrollHeight>p.clientHeight+2)return p;
  }
  return null;
 }
 function ensureRoom(state){
  if(!state.popup||document.activeElement!==state.input)return;
  const rect=state.input.getBoundingClientRect(),v=visibleFrame();
  const available=v.top+v.height-rect.bottom-10;
  if(available>=138)return;
  const container=findScroller(state.input);
  if(!container)return;
  const before=container.scrollTop,delta=Math.min(230,Math.ceil(150-available));
  container.scrollTop+=delta;
  if(container.scrollTop!==before)requestAnimationFrame(()=>movePopup(state));
 }
 function movePopup(state){
  if(!state.popup||!state.input.isConnected){if(!state.input.isConnected)hide();return;}
  const rect=state.input.getBoundingClientRect(),v=visibleFrame();
  const width=Math.min(Math.max(rect.width,230),Math.max(160,v.width-16));
  const left=Math.max(v.left+8,Math.min(rect.left,v.left+v.width-width-8));
  const top=rect.bottom+3; // Always below the typing field.
  const room=Math.max(0,v.top+v.height-top-8);
  state.popup.style.width=width+'px';
  state.popup.style.left=left+'px';
  state.popup.style.top=top+'px';
  state.popup.style.maxHeight=Math.min(280,room)+'px';
  state.popup.hidden=room<42;
 }
 function show(state){
  hide();
  const q=state.input.value.includes(' — ')?state.select.value:state.input.value;
  const items=candidates(state.select,q);
  if(!items.length){state.input.setAttribute('aria-expanded','false');return;}
  const popup=document.createElement('div');
  popup.className='solin-species-results';popup.id=state.input.id+'-suggestions';popup.setAttribute('role','listbox');
  state.items=items;state.index=0;state.popup=popup;active=state;
  const format=item=>item.code+' — '+item.label;
  popup.innerHTML=items.map((item,i)=>'<button type="button" class="solin-species-option" role="option" data-species-index="'+i+'" aria-selected="'+(i===0?'true':'false')+'">'+h(format(item))+'</button>').join('');
  document.body.append(popup);
  document.getElementById('modal')?.classList.add('solin-species-open');
  movePopup(state);
  state.input.setAttribute('aria-expanded','true');
  popup.addEventListener('pointerdown',e=>e.preventDefault());
  popup.addEventListener('click',e=>{
   const button=e.target.closest('[data-species-index]');if(!button)return;
   const item=state.items[Number(button.dataset.speciesIndex)];
   commit(state,item,true);hide();state.input.focus();state.input.select();
  });
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
  select.after(input);
  const state={select,input,popup:null,items:[],index:0};mounted.set(select,state);syncUI(state);
  input.addEventListener('focus',()=>{
   const found=entries(select).find(x=>x.code===select.value);
   if(found){input.value=found.code;input.select();}
   show(state);
   requestAnimationFrame(()=>ensureRoom(state));
   // iOS keyboard expansion is asynchronous and raises a visualViewport resize.
   setTimeout(()=>{if(active===state){ensureRoom(state);movePopup(state);}},180);
   setTimeout(()=>{if(active===state){ensureRoom(state);movePopup(state);}},400);
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
 // Modal close, scrolling or resize should never leave a floating stale menu.
 document.addEventListener('scroll',()=>{if(active)movePopup(active);},true);
 window.addEventListener('resize',()=>{if(active){ensureRoom(active);movePopup(active);}});
 window.visualViewport?.addEventListener('resize',()=>{if(active){ensureRoom(active);movePopup(active);}});
 window.visualViewport?.addEventListener('scroll',()=>{if(active)movePopup(active);});
 document.addEventListener('pointerdown',e=>{if(active&&!active.popup.contains(e.target)&&e.target!==active.input)hide();},true);
 window.SolinSpeciesEntry={mount,mountAll};
})();
