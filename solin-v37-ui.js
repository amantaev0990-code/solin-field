/* SOLI-N Field V37 — navigation, polished startup and safe stand creation.
 * UI-only enhancement. The existing card editor, forestry tables, MDB and
 * PackageInstaller remain the single source of truth.
 */
(() => {
 'use strict';
 const menuTitle='Главное меню';
 const track=[];
 const maxDepth=40;
 let backInProgress=false, activeSeen='', booted=false;
 const $=s=>document.querySelector(s);
 const visibleScreen=()=>$('.screen.active')?.id||'';
 const modalActive=()=>{
   const modal=$('#modal');
   return Boolean((modal&&!modal.classList.contains('hidden'))||
     ($('#solin-v23-leave-confirm')&&!$('#solin-v23-leave-confirm').hidden)||
     $('#v35-forest-group-dialog')||
     document.querySelector('[role="dialog"][aria-modal="true"]:not(.hidden):not(#modal)'));
 };
 function renameMainMenu(root=document){
   const header=root.querySelector?.('#mainScreen h2');
   if(header&&header.textContent?.trim()!==menuTitle)header.textContent=menuTitle;
   // Only UI controls are renamed. Never change values stored in a forest,
   // descriptive entries from the original Access catalog or search terms.
   for(const el of root.querySelectorAll?.('button, [role="button"], h1, h2, h3, .screenHead > span')||[]){
     if(el.id==='mainScreen')continue;
     for(const node of el.childNodes){
       if(node.nodeType!==3)continue;
       const next=node.nodeValue.replace(/головное меню/gi,menuTitle);
       if(next!==node.nodeValue)node.nodeValue=next;
     }
     for(const name of ['title','aria-label']){
       const raw=el.getAttribute?.(name);
       if(raw&&/головное меню/i.test(raw))
         el.setAttribute(name,raw.replace(/головное меню/gi,menuTitle));
     }
   }
 }
 function revealMenu(){
   const screen=$('#mainScreen');
   if(!screen)return false;
   if(!screen.querySelector('.v33-main-layout'))return false;
   renameMainMenu(screen);
   document.documentElement.classList.add('v37-menu-ready');
   return true;
 }
 function mountNewStand(){
   const screen=$('#card');
   const content=screen?.querySelector('#childContent');
   if(!content)return;
   let region=screen.querySelector('#solin-v37-new-stand');
   if(!region){
     region=document.createElement('div');
     region.id='solin-v37-new-stand';
     region.className='v37-new-stand-footer';
     const button=document.createElement('button');
     button.type='button';
     button.id='solin-v37-new-button';
     button.className='v37-new-stand-button';
     button.textContent='Новая';
     button.title='Создать новый выдел в текущем квартале';
     button.setAttribute('aria-label','Новая — создать выдел в текущем квартале');
     region.append(button);
     content.after(region);
     button.addEventListener('click',()=>{
       if(modalActive())return;
       if(typeof current==='undefined'||!current||
          typeof D==='undefined'||!D?.quarters){
         window.toast?.('Откройте сохранённый выдел');return;
       }
       const k=String(current.KV);
       const q=D.quarters[k];
       if(!q?.compartments?.includes(current)){
         window.toast?.('Сначала сохраните текущий новый выдел');return;
       }
       // Never modify the current entry: openCompForm creates a separate
       // unsaved preview with the next number in this very quarter/category.
       const cat=current.KGLF??null;
       if(typeof window.openCompForm!=='function'){
         window.toast?.('Создание нового выдела пока недоступно');return;
       }
       window.openCompForm(k,cat);
     });
   }
   const record=typeof current==='undefined'?null:current;
   const quarter=(typeof D==='undefined'||!record)?null:D?.quarters?.[String(record.KV)];
   const saved=Boolean(quarter?.compartments?.includes(record));
   const btn=region.querySelector('#solin-v37-new-button');
   if(btn){
     btn.disabled=!saved;
     btn.title=saved?'Создать следующий выдел в квартале '+record.KV:
       'Сначала сохраните текущий новый выдел';
   }
 }
 function installNavigation(){
   if(typeof window.show!=='function')return;
   if(window.show.__v37History)return;
   const original=window.show;
   const wrapped=function(id,...rest){
     const before=visibleScreen();
     const result=original.call(this,id,...rest);
     const after=visibleScreen();
     if(!backInProgress&&before&&after&&before!==after){
       // Coalesce repeated routes; the previous screen remains useful.
       if(track.at(-1)!==before){track.push(before);if(track.length>maxDepth)track.shift();}
     }
     if(after)activeSeen=after;
     if(after==='card')mountNewStand();
     if(after==='mainScreen')revealMenu();
     return result;
   };
   wrapped.__v37History=true;
   window.show=wrapped;
 }
 function navigationBack(){
   // Never use history.back() or finish() — both may leave the Android app.
   if(modalActive())return 'blocked-dialog';
   const now=visibleScreen();
   let target='';
   while(track.length){
     const candidate=track.pop();
     if(candidate&&candidate!==now&&document.getElementById(candidate)){
       target=candidate;break;
     }
   }
   if(!target){
     if(now==='card')target='quartersScreen';
     else if(!['mainScreen','homeScreen'].includes(now))
       target=document.getElementById('mainScreen')?'mainScreen':'homeScreen';
   }
   if(!target||!document.getElementById(target)||target===now)
     return 'blocked-root';
   backInProgress=true;
   try{
     window.show?.(target);
     return visibleScreen()===target?'navigated':'blocked-route';
   }finally{backInProgress=false;}
 }
 function boot(){
   if(booted)return;booted=true;
   installNavigation();
   renameMainMenu();
   mountNewStand();
   revealMenu();
   const screen=$('#mainScreen');
   if(screen&&!document.documentElement.classList.contains('v37-menu-ready')){
     const observer=new MutationObserver(()=>{
       if(revealMenu())observer.disconnect();
     });
     observer.observe(screen,{subtree:true,childList:true});
     // A failed layout module should not leave the menu permanently invisible.
     setTimeout(()=>{
       observer.disconnect();
       if(!document.documentElement.classList.contains('v37-menu-ready')){
         document.documentElement.classList.add('v37-menu-fallback');
         console.error('SOLI-N Field: compact menu failed to initialize');
       }
     },5000);
   }
   const prev=window.renderComp;
   if(typeof prev==='function'&&!prev.__v37NewButton){
     const wrapped=function(...args){const value=prev.apply(this,args);mountNewStand();return value;};
     wrapped.__v37NewButton=true;
     window.renderComp=wrapped;
   }
   // Legacy headings can appear after asynchronous workspace initialization.
   document.addEventListener('solin-workspaces-ready',()=>renameMainMenu());
   window.addEventListener('solin-ready',()=>renameMainMenu());
   document.addEventListener('backbutton',event=>{
     event.preventDefault?.();event.stopImmediatePropagation?.();
     navigationBack();
   },true);
 }
 window.SolinV37={back:navigationBack,refresh:mountNewStand,renameMainMenu};
 if(document.readyState==='loading')
   document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})();