// SOLI-N Field: compact fixed shell + fixed CarryMap-style selection card.
(function(){
  // Toggle the very compact header when the map section is opened.
  const previousShow=window.show;
  window.show=function(id){
    previousShow(id);
    document.body.classList.toggle('map-mode',id==='mapScreen');
    const active=document.getElementById(id);
    if(active&&id!=='mapScreen') active.scrollTop=0;
    if(id==='mapScreen') setTimeout(()=>window.fieldMap?.invalidateSize?.(),80);
  };

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

  // Initial state (quarters is the default screen).
  document.body.classList.toggle('map-mode',document.getElementById('mapScreen')?.classList.contains('active'));
})();
