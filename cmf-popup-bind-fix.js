/* Pass the clicked Leaflet layer + coordinates into the CarryMap bottom sheet.
   This keeps Zoom/Target working and lets the sheet show the clicked coordinate. */
(function(){
  window.bindImportedFeature=function(feature,layer){
    layer.on('click',e=>{
      if(typeof showCmfSheet==='function')showCmfSheet(feature,e?.latlng||null,layer);
      else{
        const p=feature?.properties||{};
        layer.bindPopup(Object.entries(p).filter(([k])=>!/^CMF_/i.test(k)&&!/^_/.test(k)).slice(0,20).map(([k,v])=>`<b>${escapeMapHtml(k)}</b>: ${escapeMapHtml(v)}`).join('<br>')||'Объект').openPopup();
      }
    });
  };
})();
