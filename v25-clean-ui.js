/* SOLI-N Field V25 — UI-only adapter. No storage, calculations or MDB writes. */
(() => {
 'use strict';
 if(typeof document==='undefined')return;
 document.body.classList.add('solin-v25');
 const escapeText=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cardTabs=[
  ['site','Участок'],
  ['trees','Древостой'],
  ['makets','Макеты']
 ];
 function setTab(form,tab){
  if(!cardTabs.some(x=>x[0]===tab))tab='trees';
  for(const [id] of cardTabs)form.classList.toggle('v25-tab-'+id,id===tab);
  for(const b of form.querySelectorAll('[data-v25-card-tab]')){
    const selected=b.dataset.v25CardTab===tab;
    b.setAttribute('aria-selected',selected?'true':'false');
    b.tabIndex=selected?0:-1;
  }
  const pane=form.querySelector('.dt-viewport');if(pane)pane.scrollTop=0;
 }
 function readField(row,field){
   const input=row.querySelector('[data-ce-field="'+field+'"]');
   if(!input)return '';
   const value=String(input.value??'').trim();
   if(!value)return '';
   return input.tagName==='SELECT'&&input.selectedOptions?.length
     ?String(input.selectedOptions[0].textContent||value).trim():value;
 }
 function renderStand(form){
  const host=form.querySelector('#v25-stand-list');
  const table=form.querySelector('#ce-table-Макет10');
  if(!host||!table)return;
  const rows=[...table.querySelectorAll('tbody tr')];
  host.replaceChildren();
  if(!rows.length){
    const empty=document.createElement('p');
    empty.className='v25-stand-empty';
    empty.textContent='Древостой не заполнен';
    host.append(empty);return;
  }
  rows.forEach((tr,i)=>{
    const row=document.createElement('button');
    row.type='button';row.className='v25-stand-item';
    const species=readField(tr,'POR')||'Порода не указана';
    const coefficient=readField(tr,'KOEF')||'—';
    const layer=readField(tr,'IAR')||'—';
    const age=readField(tr,'LET')||'—';
    const height=readField(tr,'PH')||'—';
    const diameter=readField(tr,'PD2')||'—';
    const stock=readField(tr,'ZAP')||'—';
    const fullness=readField(tr,'POL')||'—';
    const head=document.createElement('strong');
    head.textContent=(i+1)+'. '+species+' · '+coefficient+'/10';
    const details=document.createElement('small');
    details.textContent='Ярус '+layer+' · '+age+' лет · '+height+' м · '+diameter+' см · полнота '+fullness+' · '+stock+' м³/га';
    row.append(head,details);
    row.addEventListener('click',()=>{
       rows.forEach((element,index)=>element.classList.toggle('dt-selected',index===i));
       const editor=window.SolinCardAssist;
       if(editor?.openRowEditor)editor.openRowEditor();
       else { form.classList.add('v25-table-expanded');table.scrollIntoView({block:'nearest'}); }
    });
    host.append(row);
  });
 }
 function enhanceCard(form){
   if(!form||form.dataset.v25Enhanced==='1')return;
   form.dataset.v25Enhanced='1';
   const toolbar=form.querySelector('.dt-toolbar');
   const tools=toolbar?.querySelector('.dt-tools');
   if(!toolbar||!tools)return;
   const tabs=document.createElement('nav');
   tabs.className='v25-card-tabs';tabs.setAttribute('aria-label','Редактирование карточки');
   for(const [id,label] of cardTabs){
     const button=document.createElement('button');button.type='button';button.dataset.v25CardTab=id;
     button.textContent=label;
     button.addEventListener('click',()=>setTab(form,id));
     tabs.append(button);
   }
   toolbar.after(tabs);
   // Move existing advanced actions, preserving their original click handlers.
   const advanced=[...tools.querySelectorAll('[data-ce-support],[data-ce-makets],[data-ce-controls]')];
   if(advanced.length){
     const extra=document.createElement('details');extra.className='v25-card-tools';
     const summary=document.createElement('summary');summary.textContent='Дополнительно';
     const body=document.createElement('div');
     advanced.forEach(button=>body.append(button));
     extra.append(summary,body);
     tools.append(extra);
   }
   const stand=form.querySelector('.dt-stand');
   const table=stand?.querySelector('#ce-table-Макет10');
   if(stand&&table){
      const overview=document.createElement('div');overview.id='v25-stand-list';overview.className='v25-stand-list';
      table.before(overview);
      const command=document.createElement('div');command.className='v25-stand-command';
      const add=document.createElement('button');add.type='button';add.id='v25-stand-add';add.textContent='＋ Строка';
      add.onclick=()=>{
        const original=table.querySelector('[data-ce-add="Макет10"]');
        if(original){original.click();renderStand(form);}
        else {form.classList.add('v25-table-expanded');table.scrollIntoView({block:'nearest'});}
      };
      const toggle=document.createElement('button');toggle.type='button';toggle.id='v25-stand-table';toggle.textContent='Таблица';
      toggle.onclick=()=>{
        const show=form.classList.toggle('v25-table-expanded');
        toggle.setAttribute('aria-expanded',show?'true':'false');
        if(show)table.scrollIntoView({block:'nearest'});
      };
      command.append(add,toggle);overview.after(command);
      let scheduled=false;
      const schedule=()=>{
        if(scheduled)return;scheduled=true;
        requestAnimationFrame(()=>{scheduled=false;if(form.isConnected)renderStand(form);});
      };
      const watcher=new MutationObserver(schedule);
      watcher.observe(table,{childList:true,subtree:true});
      form.addEventListener('input',e=>{if(table.contains(e.target))schedule();});
      form.addEventListener('change',e=>{if(table.contains(e.target))schedule();});
      // Disconnect when the original editor removes the form.
      const stop=new MutationObserver(()=>{if(!form.isConnected){watcher.disconnect();stop.disconnect();}});
      stop.observe(document.getElementById('modal'),{childList:true,subtree:true});
      renderStand(form);
   }
   form.addEventListener('submit',()=>setTimeout(()=>revealInvalid(form),0),true);
   form.addEventListener('click',e=>{
      const jump=e.target.closest('[data-ce-jump],[data-ce-nav-maket],[data-ce-extra]');
      if(!jump)return;
      const n=String(jump.dataset.ceJump||jump.dataset.ceNavMaket||jump.dataset.ceExtra||'');
      if(n==='10')setTab(form,'trees');
      else if(['31','32','Макет31','Макет32'].includes(n)||/^Макет\d+$/.test(n)&&n!=='Макет10')setTab(form,'makets');
      else if(['1','2','3','main'].includes(n))setTab(form,'site');
      else if(['4','5'].includes(n))setTab(form,'trees');
   },true);
   setTab(form,'trees');
 }
 function enhanceStandModal(){
   const modal=document.getElementById('modal');
   if(!modal)return;
   modal.classList.toggle('v25-stand-modal',Boolean(modal.querySelector('#wfCompRows')&&!modal.classList.contains('ce-modal')));
 }
 function revealInvalid(form){
   if(!form.isConnected)return;
   const invalid=form.querySelector('[aria-invalid="true"],[aria-invalid=true]');
   if(!invalid)return;
   const section=invalid.closest('[id^="ce-section-"]');
   const number=section?.id.replace('ce-section-','');
   if(number==='10'||number==='4'||number==='5')setTab(form,'trees');
   else if(number==='31'||number==='32'||number&&Number(number)>10)setTab(form,'makets');
   else setTab(form,'site');
 }
 function tidyMenu(){
    const host=document.querySelector('#menuScreen .workspace');
    if(!host)return;
    let details=host.querySelector('#v25MenuExtra');
    const surplus=[...host.querySelectorAll('.menuRow')].filter(button=>
       button.id!=='solin-mdb-export'&&button.id!=='solin-update-button'&&
       !button.closest('#v25MenuExtra'));
    if(!surplus.length)return;
    if(!details){
      details=document.createElement('details');
      details.id='v25MenuExtra';details.className='v25-menu-extra';
      details.innerHTML='<summary>Дополнительные функции</summary><div></div>';
      host.append(details);
    }
    surplus.forEach(button=>details.querySelector('div').append(button));
 }
 function init(){
   document.body.classList.add('solin-v25');
   const modal=document.getElementById('modal');
   if(modal){
      enhanceCard(modal.querySelector('#ce-form'));
      const observer=new MutationObserver(()=>{enhanceCard(modal.querySelector('#ce-form'));enhanceStandModal();});
      observer.observe(modal,{childList:true,subtree:false});
      // #ce-form is inserted into #modalBody, not directly into #modal;
      const inner=modal.querySelector('#modalBody');
      if(inner)observer.observe(inner,{childList:true,subtree:false});
   }
   enhanceStandModal();
   tidyMenu();
   const menu=document.querySelector('#menuScreen .workspace');
   if(menu){const observer=new MutationObserver(tidyMenu);observer.observe(menu,{childList:true,subtree:false});}
 }
 window.SolinV25UI={setTab,enhanceCard,renderStand,tidyMenu};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();