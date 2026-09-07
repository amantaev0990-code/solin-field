/* SOLI-N Field map viewport fullscreen.
   Uses a CSS viewport mode instead of relying on the browser Fullscreen API, so it
   also works in iPhone Safari/PWA. */
(function(){
'use strict';
function ensureButton(){
  const wrap=document.querySelector('#mapScreen .mapWrap');if(!wrap||document.getElementById('mapFullscreenBtn'))return false;
  const b=document.createElement('button');b.id='mapFullscreenBtn';b.className='mapFullscreenBtn';b.type='button';b.innerHTML='⛶';b.setAttribute('aria-label','Карта на весь экран');b.title='Карта на весь экран';b.onclick=toggleMapFullscreen;wrap.appendChild(b);return true;
}
function resizeMap(){try{if(typeof fieldMap!=='undefined'&&fieldMap)fieldMap.invalidateSize({pan:false})}catch(_){}}
window.toggleMapFullscreen=function(force){
  ensureButton();const screen=document.getElementById('mapScreen'),btn=document.getElementById('mapFullscreenBtn');if(!screen)return;
  const on=typeof force==='boolean'?force:!screen.classList.contains('mapFullscreenMode');
  screen.classList.toggle('mapFullscreenMode',on);document.body.classList.toggle('mapFullscreenBody',on);
  if(btn){btn.innerHTML=on?'×':'⛶';btn.setAttribute('aria-label',on?'Выйти из полноэкранной карты':'Карта на весь экран');btn.title=on?'Выйти из полноэкранной карты':'Карта на весь экран'}
  setTimeout(resizeMap,60);setTimeout(resizeMap,260);
};
function install(){if(ensureButton())return;setTimeout(ensureButton,0);setTimeout(ensureButton,300)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
window.addEventListener('orientationchange',()=>setTimeout(resizeMap,250));
})();
