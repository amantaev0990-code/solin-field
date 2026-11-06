/* V23 field-safety: only the deliberate X may request manual closing. */
(()=>{'use strict';
 let modalSnapshot=null, modalTitle=null, bypass=false;
 const modal=()=>document.getElementById('modal');
 const values=()=>{const body=document.getElementById('modalBody');return JSON.stringify([...body.querySelectorAll('input,select,textarea')].filter(x=>!['hidden','button','submit'].includes(x.type)).map(x=>[x.id,x.name,x.type==='checkbox'?x.checked:x.value]));};
 function shown(){return modal()&&!modal().classList.contains('hidden');}
 function remember(){if(!shown())return;modalTitle=document.getElementById('modalTitle')?.textContent||'';modalSnapshot=values();}
 function confirmUnsaved(callbacks){
  if(document.getElementById('solin-v23-leave-confirm'))return;
  const d=document.createElement('div');d.id='solin-v23-leave-confirm';d.setAttribute('role','alertdialog');d.setAttribute('aria-modal','true');
  d.setAttribute('aria-label','Несохранённые изменения');
  d.style.cssText='position:fixed;z-index:2147483647;inset:0;background:#14282099;display:grid;place-items:center;padding:18px';
  d.innerHTML='<div style="max-width:460px;width:100%;background:white;color:#162c23;border-radius:16px;padding:24px;box-shadow:0 16px 60px #0005;font:16px Arial"><h3 style="margin:0 0 10px">Есть несохранённые изменения</h3><p>Сохранить перед закрытием? При отмене введённые данные останутся в карточке.</p><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:end"><button type="button" data-v23="cancel">Отмена</button><button type="button" data-v23="discard">Не сохранять</button><button type="button" data-v23="save" style="background:#125b38;color:white">Сохранить</button></div></div>';
  document.body.append(d);
  const old=document.activeElement;d.querySelector('[data-v23="cancel"]').focus();
  d.addEventListener('click',e=>{const b=e.target.closest('[data-v23]');if(!b)return;const cmd=b.dataset.v23;d.remove();if(cmd==='cancel')old?.focus?.();if(cmd==='save')callbacks.save?.();if(cmd==='discard')callbacks.discard?.();});
 }
 function requestClose(){if(!shown())return;const m=modal();
  if(m.classList.contains('ce-modal'))return; // SOLIN card editor owns its dirty-draft prompt.
  if(modalSnapshot!==null&&values()!==modalSnapshot){confirmUnsaved({
    save:()=>{const body=document.getElementById('modalBody');const b=body.querySelector('button[id$="Save"],button[id$="save"],button.primary,[type="submit"]');if(b)b.click();else alert('Для сохранения используйте кнопку в окне. Введённые данные не потеряны.');},
    discard:()=>{bypass=true;closeModal();bypass=false},cancel:()=>{}
   });return;}
  bypass=true;closeModal();bypass=false;
 }
 document.addEventListener('click',e=>{const x=e.target.closest('#modal .modalHead>.close');if(!x||!shown()||modal().classList.contains('ce-modal'))return;e.preventDefault();e.stopImmediatePropagation();requestClose();},true);
 document.addEventListener('keydown',e=>{if(!shown())return;if(e.key==='Escape'&&document.getElementById('solin-v23-leave-confirm'))e.preventDefault();},true);
 const watch=new MutationObserver(()=>{if(!shown())modalSnapshot=null;else if(modalTitle!==document.getElementById('modalTitle')?.textContent||modalSnapshot===null)setTimeout(remember,150)});
 const attach=()=>{const el=modal();if(el)watch.observe(el,{attributes:true,attributeFilter:['class']});};
 if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
 window.SolinV23ModalGuard={confirmUnsaved,requestClose,remember};
})();