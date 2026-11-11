/* V35 — editable Maket 3 proxies and premium, low-cost screen motion.
 * Only real original-backed M3Pr/M3TLU selects store values; no new database.
 */
(() => {
 'use strict';
 const quickFields=[
  {field:'M3Pr',hint:'Выберите главную породу'},
  {field:'M3TLU',hint:'Выберите характеристику типа леса'}
 ];
 const reduce=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 function actual(field){
   return document.querySelector('#ce-form #ce-section-10 [data-ce-scope="base"][data-ce-field="'+field+'"]');
 }
 function detail(field){
   const el=actual(field);
   if(!el)return null;
   const value=String(el.value||''),option=[...el.options].find(o=>o.value===value);
   const display=option?.textContent?.trim()||
     (value?window.SolinHuman?.value?.('ВыделВ',field,value):'');
   return {el,value,display};
 }
 function setButton(button,field){
   const info=detail(field),title=quickFields.find(x=>x.field===field)?.hint||'Выбрать';
   const label=button.querySelector('.v35-value');
   if(!label)return;
   const nextLabel=info?.value?
     (info.display||info.value):(field==='M3TLU'&&!detail('M3Pr')?.value?'Сначала выберите породу':title);
   if(label.textContent!==nextLabel)label.textContent=nextLabel;
   button.title=info?.el?.title||'Поиск по коду и названию';
   const incomplete=info?.el?.dataset.dependentStatus;
   button.dataset.v35Status=incomplete||'';
   button.setAttribute('aria-label',field==='M3Pr'?
     'Изменить главную породу':'Изменить характеристику типа леса');
 }
 function mountCardFields(){
   const card=document.querySelector('#modal.ce-modal #ce-form');
   const s3=card?.querySelector('#ce-section-3');
   if(!s3)return;
   for(const {field} of quickFields){
     const fixed=[...s3.querySelectorAll('.dt-fixed')].find(node=>{
       const label=node.querySelector('span')?.textContent||'';
       return field==='M3Pr'?label.startsWith('Главная порода'):label.startsWith('Тип леса');
     });
     if(!fixed)continue;
     let button=fixed.querySelector('[data-v35-open]');
     if(!button){
       // The V34 readonly duplicate in Maket 3 is a display-only mock. Replace
       // just its UI with a button opening the ONE real canonical select.
       const input=fixed.querySelector('input[readonly]');
       if(!input)continue;
       button=document.createElement('button');
       button.type='button';
       button.className='v35-select-button';
       button.dataset.v35Open=field;
       button.innerHTML='<span class="v35-value"></span><span class="v35-chevron" aria-hidden="true">⌄</span>';
       input.replaceWith(button);
     }
     setButton(button,field);
   }
   for(const field of ['M3Pr','M3TLU']){
     const el=actual(field);
     const output=el?.closest('.dt-cell')?.querySelector('output[data-ce-display-for]');
     if(!output||output.dataset.v35Open)return;
     output.dataset.v35Open=field;
     output.tabIndex=0;
     output.setAttribute('role','button');
     output.setAttribute('aria-label','Выбрать: '+(field==='M3Pr'?'главную породу':'характеристику типа леса'));
     output.title='Нажмите, чтобы открыть справочник';
   }
 }
 function currentCard(){
   const card={};
   for(const el of document.querySelectorAll('#ce-form [data-ce-scope="base"][data-ce-field]')){
     card[el.dataset.ceField]=el.value;
   }
   return card;
 }
 function originalOrg(){
   return typeof D!=='undefined'?D?.lesnichestvo?.[0]||null:null;
 }
 function chooseGroup(groups){
   const modal=document.querySelector('#modal.ce-modal');
   if(!modal||!groups?.length)return false;
   if(modal.querySelector('#v35-forest-group-dialog'))return true;
   const input=modal.querySelector('#ce-form [data-ce-scope="base"][data-ce-field="NE2A"]');
   if(!input){
     // No matching original base field: never write an invented extra field.
     return false;
   }
   const sheet=document.createElement('div');
   sheet.id='v35-forest-group-dialog';
   sheet.className='v35-group-overlay';
   sheet.setAttribute('role','dialog');
   sheet.setAttribute('aria-modal','true');
   sheet.setAttribute('aria-label','Выбор группы типа леса');
   const content=document.createElement('div');
   content.className='v35-group-panel';
   const head=document.createElement('div');
   head.className='v35-group-head';
   const title=document.createElement('strong');
   title.textContent='Группа типа леса';
   const close=document.createElement('button');
   close.type='button';
   close.textContent='×';
   close.className='v35-group-close';
   close.setAttribute('aria-label','Закрыть выбор группы');
   close.addEventListener('click',()=>sheet.remove());
   head.append(title,close);
   const info=document.createElement('p');
   info.textContent='Для этой породы в исходном STL есть разные группы. Выберите нужную — затем откроются соответствующие типы леса.';
   const choices=document.createElement('div');
   choices.className='v35-group-choices';
   for(const group of groups){
     const item=document.createElement('button');
     item.type='button';
     item.className='v35-group-item';
     item.textContent='Группа '+group+(String(input.value)===String(group)?' (текущая)':'');
     item.addEventListener('click',()=>{
       // Changing a source STL group invalidates any previously selected type.
       // Clear only the current draft's original field, never an imported row.
       const value=String(group);
       if(input.value!==value){
         const forestSelect=modal.querySelector('#ce-form [data-ce-scope="base"][data-ce-field="M3TLU"]');
         if(forestSelect?.value){
           forestSelect.value='';
           forestSelect.dispatchEvent(new Event('input',{bubbles:true}));
           forestSelect.dispatchEvent(new Event('change',{bubbles:true}));
         }
         input.value=value;
         input.dispatchEvent(new Event('input',{bubbles:true}));
         input.dispatchEvent(new Event('change',{bubbles:true}));
       }
       sheet.remove();
       window.SolinCardEditor?.refreshDependencies?.();
       window.SolinCardAssist?.openFieldByKey?.('M3TLU');
     });
     choices.append(item);
   }
   content.append(head,info,choices);
   sheet.append(content);
   modal.append(sheet);
   close.focus();
   return true;
 }
 function openField(field){
   const el=actual(field);
   if(!el)return;
   if(field==='M3TLU'&&!detail('M3Pr')?.value){
     window.SolinCardAssist?.openFieldByKey?.('M3Pr');
     return;
   }
   if(field==='M3TLU'){
     const ctx=currentCard();
     const result=window.SolinDependentRules?.forestTypes?.(ctx,originalOrg(),window.SOLIN_REFS?.tables);
     // An existing NE2A value must not silently hide alternative legitimate
     // STL groups. Offer the group chooser even when a group is already set.
     if(result?.groups?.length>1){
       if(chooseGroup(result.groups))return;
     }
   }
   if(window.SolinCardAssist?.openFieldByKey?.(field))return;
   // Fallback remains a real select with original code values, not a new form.
   el.scrollIntoView({block:'center',behavior:reduce()?'auto':'smooth'});
   el.focus({preventScroll:true});
   el.click();
 }
 function onClick(e){
   const btn=e.target.closest?.('[data-v35-open]');
   if(!btn||!document.querySelector('#modal.ce-modal #ce-form'))return;
   e.preventDefault();
   e.stopPropagation();
   openField(btn.dataset.v35Open);
 }
 function animateScreen(){
   if(typeof window.show!=='function'||window.show.__v35Motion)return;
   const old=window.show;
   const wrapped=function(id,...args){
     const before=document.querySelector('.screen.active');
     const result=old.call(this,id,...args);
     const after=document.querySelector('.screen.active');
     if(!reduce()&&after&&after!==before){
       after.classList.remove('v35-screen-in');
       void after.offsetWidth;
       after.classList.add('v35-screen-in');
       const end=()=>after.classList.remove('v35-screen-in');
       after.addEventListener('animationend',end,{once:true});
     }
     return result;
   };
   wrapped.__v35Motion=true;
   window.show=wrapped;
 }
 // Used by the compact tablet input, whose original type select is moved
 // from Maket 10 to the visible "Поля выдела" pane.
 window.SolinForestGroups={
   open(){
     const ctx=currentCard();
     const result=window.SolinDependentRules?.forestTypes?.(ctx,originalOrg(),window.SOLIN_REFS?.tables);
     return result?.groups?.length>1 ? chooseGroup(result.groups) : false;
   },
   available(){
     const ctx=currentCard();
     return window.SolinDependentRules?.forestTypes?.(ctx,originalOrg(),window.SOLIN_REFS?.tables);
   }
 };
 function init(){
   animateScreen();
   const modal=document.getElementById('modal');
   if(modal){
     const observer=new MutationObserver(mountCardFields);
     observer.observe(modal,{childList:true,subtree:true});
     mountCardFields();
   }
   document.addEventListener('click',onClick);
   document.addEventListener('keydown',e=>{
     if(!['Enter',' '].includes(e.key))return;
     const btn=e.target.closest?.('output[data-v35-open]');
     if(!btn)return;
     e.preventDefault();
     openField(btn.dataset.v35Open);
   });
   document.addEventListener('change',e=>{
     if(e.target.matches?.('#ce-form select[data-ce-scope="base"][data-ce-field="M3Pr"],#ce-form select[data-ce-scope="base"][data-ce-field="M3TLU"]'))
       queueMicrotask(mountCardFields);
   },true);
   document.body.classList.add('v35-premium');
 }
 if(document.readyState==='loading')
   document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
