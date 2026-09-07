// SOLI-N Field: fixed CarryMap-style selection card.
// The card opens only from an object click and remains fixed until the X is pressed.
(function(){
  window.bindCmfSheetDrag=function(){ /* dragging intentionally disabled */ };

  window.showCmfSheet=function(feature,latlng,layer){
    cmfSheetLayer=layer||cmfSheetLayer;
    window.__cmfSelectedLayer=layer||window.__cmfSelectedLayer;
    let sheet=document.getElementById('cmfSheet');
    if(!sheet){
      sheet=document.createElement('div');
      sheet.id='cmfSheet';
      sheet.className='cmfSheet';
      document.querySelector('#mapScreen .mapWrap')?.appendChild(sheet);
    }
    sheet.style.bottom='';
    sheet.classList.remove('peek','dragging');
    sheet.innerHTML=`<button class="cmfSheetClose" type="button" aria-label="Закрыть" onclick="closeCmfSheet()">×</button>${cmfStandPopup(feature,latlng)}`;
    sheet.classList.add('open');
  };

  window.closeCmfSheet=function(){
    const sheet=document.getElementById('cmfSheet');
    if(!sheet)return;
    sheet.classList.remove('open','peek','dragging');
    sheet.style.bottom='';
  };

  // Stop the browser page itself from rubber-banding on iPhone.
  document.addEventListener('touchmove',function(e){
    const target=e.target;
    if(target?.closest?.('.screen.active,.cmfSheet,.mapLayerPanel,.leaflet-container'))return;
    if(e.cancelable)e.preventDefault();
  },{passive:false});
})();
