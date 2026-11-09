/* V33 UI patch: retain original V30 screens, stored records and calculation
   handlers. Only reorganise existing controls and improve field navigation. */
(() => {
  'use strict';
  const menuGroups = [
    {title:'Полевая работа',routes:[
      ['quartersScreen','▤',true],['mapScreen','⌖'],
      ['control','✓'],['filter','⌕']
    ]},
    {title:'Данные',routes:[
      ['homeScreen','▦'],['transferScreen','⇧'],
      ['__import__','⇩']
    ]},
    {title:'Справочники',routes:[
      ['refsScreen','▥'],['calculationRefs','∑']
    ]},
    {title:'Программа',routes:[['menuScreen','⚙']]}
  ];
  function initMenu() {
    const screen=document.getElementById('mainScreen');
    const host=screen?.querySelector('.workspace');
    const nav=host?.querySelector('.field-main-actions');
    const context=host?.querySelector('.field-context');
    if(!host||!nav||!context||host.querySelector('.v33-main-layout'))return;
    const old=[...nav.children];
    const find=(route)=>old.find(item => route==='__import__'
      ? item.classList?.contains('field-import')
      : item.dataset?.fieldRoute===route);
    // The real original buttons and transfer input are moved, NEVER cloned.
    const layout=document.createElement('div');
    layout.className='v33-main-layout';
    const aside=document.createElement('aside');
    aside.className='v33-context-col';
    const heading=document.createElement('h3');
    heading.className='v33-block-title';
    heading.textContent='Рабочий объект';
    aside.append(heading,context);
    const main=document.createElement('div');
    main.className='v33-actions-col';
    nav.replaceChildren();
    for(const group of menuGroups){
      const section=document.createElement('section');
      section.className='v33-menu-group';
      const groupTitle=document.createElement('h3');
      groupTitle.textContent=group.title;
      section.append(groupTitle);
      for(const [route,symbol,isPrimary] of group.routes){
        const item=find(route);
        if(!item)continue; // Do not invent a route unavailable in this build.
        if(isPrimary)item.classList.add('v33-primary');
        const glyph=document.createElement('span');
        glyph.className='v33-menu-symbol';
        glyph.textContent=symbol;
        glyph.setAttribute('aria-hidden','true');
        item.prepend(glyph);
        section.append(item);
      }
      nav.append(section);
    }
    // Do not discard unknown future actions from the original menu.
    const extras=old.filter(el=>!el.parentElement?.classList.contains('v33-menu-group'));
    if(extras.length){
      const section=document.createElement('section');
      section.className='v33-menu-group';
      const title=document.createElement('h3');
      title.textContent='Другие действия';
      section.append(title,...extras);
      nav.append(section);
    }
    main.append(nav);
    layout.append(aside,main);
    host.append(layout);
    const brand=document.querySelector('.topbar .brand');
    if(brand&&!brand.querySelector('.v33-brandmark')){
      const logo=document.createElement('img');
      logo.src='solin-field-icon.png';
      logo.className='v33-brandmark';
      logo.alt='';
      logo.decoding='async';
      brand.prepend(logo);
    }
    document.body.classList.add('v33-app');
  }

  const jumps=[
    ['1','Макет 1'],['2','Макет 2'],['3','Макет 3'],['4','Макет 4'],
    ['5','Запас · М5'],['10','Древостой · М10'],
    ['31','Подрост · М31'],['32','Подлесок · М32']
  ];
  function enhanceCard(){
    const form=document.querySelector('#modal.ce-modal #ce-form');
    if(!form||form.dataset.v33Enhanced)return;
    const viewport=form.querySelector('.dt-viewport');
    if(!viewport)return;
    form.dataset.v33Enhanced='1';
    const toolbar=document.createElement('nav');
    toolbar.className='v33-card-jump';
    toolbar.setAttribute('aria-label','Переход к макету карточки');
    for(const [id,label] of jumps){
      if(!form.querySelector('#ce-section-'+id))continue;
      const button=document.createElement('button');
      button.type='button';
      button.dataset.v33Jump=id;
      button.textContent=label;
      toolbar.append(button);
    }
    const count=document.createElement('output');
    count.className='v33-check-count';
    count.setAttribute('aria-live','polite');
    toolbar.append(count);
    viewport.before(toolbar);
    const updateErrors=()=>{
      const errors=form.querySelectorAll('[data-ce-field][aria-invalid="true"]').length;
      count.textContent=errors?('Ошибок: '+errors):'';
    };
    form.addEventListener('input',updateErrors,{passive:true});
    form.addEventListener('change',updateErrors,{passive:true});
    form.addEventListener('focusout',()=>queueMicrotask(updateErrors),{passive:true});
    updateErrors();
  }
  function findNextField(form,current,backwards){
    const fields=[...form.querySelectorAll('[data-ce-field]')].filter(el=>{
      if(el.disabled||el.readOnly||el.getAttribute('aria-hidden')==='true'||el.classList.contains('solin-species-native'))return false;
      if(el.closest('[hidden]'))return false;
      if(!el.isConnected||!el.getClientRects().length)return false;
      return true;
    });
    const at=fields.indexOf(current);
    if(at<0)return null;
    return fields[at+(backwards?-1:1)]||null;
  }
  document.addEventListener('keydown',event=>{
    const form=document.querySelector('#modal.ce-modal #ce-form');
    if(!form||event.isComposing)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){
      event.preventDefault();
      if(!form.querySelector('#ce-save:disabled'))form.requestSubmit();
      return;
    }
    const target=event.target;
    if(event.key!=='Enter'||!target?.matches?.('input[data-ce-field]'))return;
    if(target.closest('.solin-species-results')||event.altKey||event.ctrlKey||event.metaKey)return;
    const next=findNextField(form,target,event.shiftKey);
    event.preventDefault(); // Enter MUST NOT accidentally submit the card.
    target.blur(); // Validation is intentionally triggered before moving.
    if(!next)return;
    if(target.getAttribute('aria-invalid')==='true')return;
    next.focus({preventScroll:true});
    next.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
  });
  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('[data-v33-jump]');
    if(!btn)return;
    const modal=document.querySelector('#modal.ce-modal');
    if(!modal)return;
    if(!modal.querySelector('#ce-extra')?.hidden)
      modal.querySelector('[data-ce-main]')?.click();
    const section=modal.querySelector('#ce-section-'+btn.dataset.v33Jump);
    if(!section)return;
    modal.querySelectorAll('[data-v33-jump]').forEach(x=>
      x.setAttribute('aria-current',x===btn?'true':'false'));
    section.scrollIntoView({block:'start',inline:'nearest',behavior:
      matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  });
  function init(){
    initMenu();
    const modal=document.getElementById('modal');
    if(modal){
      const observer=new MutationObserver(enhanceCard);
      observer.observe(modal,{childList:true,subtree:true});
      enhanceCard();
    }
    document.body.classList.add('v33-app');
  }
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
