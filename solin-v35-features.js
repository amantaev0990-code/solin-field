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
   label.textContent=info?.value?
     (info.display||info.value):(field==='M3TLU'&&!detail('M3Pr')?.value?'Сначала выберите породу':title);
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
 function openField(field){
   const el=actual(field);
   if(!el)return;
   if(field==='M3TLU'&&!detail('M3Pr')?.value){
     window.SolinCardAssist?.openFieldByKey?.('M3Pr');
     return;
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
