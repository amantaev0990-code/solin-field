/* CarryMap-like styling/labels/selection for decoded CMF2 geometry. */
(function(){
 let selected=null;
 function layerName(f){return String(f?.properties?.CMF_LAYER||'').toLowerCase()}
 function isStand(f){return /выдпород|выдел/.test(layerName(f))}
 function isWater(f){return /воды|берега|вод/.test(layerName(f))}
 function isRoad(f){return /дороги|дорог/.test(layerName(f))}
 function isQuarter(f){return /квпрос|кварт/.test(layerName(f))}
 function isLandBorder(f){return /грзем/.test(layerName(f))}
 function normalStyle(f){
   const t=String(f?.geometry?.type||'');
   if(isRoad(f)) return {color:'#ff2b2b',weight:3.2,opacity:1,fillOpacity:0};
   if(isWater(f)) return {color:'#42b7ff',weight:2.5,opacity:1,fillColor:'#42b7ff',fillOpacity:t.includes('Polygon')?.32:0};
   if(isQuarter(f)) return {color:'#1677ff',weight:3.2,opacity:1,fillOpacity:0};
   if(isStand(f)) return {color:'#18a64a',weight:2.1,opacity:1,fillColor:'#18a64a',fillOpacity:.035};
   if(isLandBorder(f)) return {color:'#1677ff',weight:2.4,opacity:.95,fillOpacity:0};
   if(t.includes('Line')) return {color:'#222',weight:1.8,opacity:.9,fillOpacity:0};
   if(t.includes('Polygon')) return {color:'#18a64a',weight:1.7,opacity:.9,fillOpacity:.03};
   return {weight:2,fillOpacity:.7};
 }
 function selectedStyle(f){const s=normalStyle(f);return {...s,color:'#ffd400',weight:Math.max(4,(s.weight||2)+2),opacity:1,fillColor:s.fillColor||'#ffd400',fillOpacity:f?.geometry?.type?.includes('Polygon')?.18:s.fillOpacity};}
 function read(p,names){for(const n of names)if(p?.[n]!==undefined&&p[n]!==null&&p[n]!=='')return p[n];return null}
 function labelText(f){const p=f?.properties||{},q=read(p,['Nкварт','NКВАРТ','Квартал','KV']),v=read(p,['Nвыд','NВЫД','Выдел','VD']),a=read(p,['Площ','Площадь','PL']);if(q==null&&v==null&&a==null)return'';const top=[q!=null?`Кв ${q}`:'',v!=null?`Выд ${v}`:''].filter(Boolean).join(' · '),bottom=a!=null?`${String(a).replace('.',',')} га`:'';return [top,bottom].filter(Boolean).join('\n')}
 function resetSelection(){if(selected?.layer?.setStyle)selected.layer.setStyle(normalStyle(selected.feature));selected=null}
 window.styleImportedFeature=normalStyle;
 window.bindImportedFeature=function(feature,layer){
   if(isStand(feature)&&layer.bindTooltip){const txt=labelText(feature);if(txt)layer.bindTooltip(txt,{permanent:true,direction:'center',className:'standPermanentLabel',interactive:false});}
   layer.on('click',e=>{resetSelection();selected={feature,layer};if(layer.setStyle)layer.setStyle(selectedStyle(feature));if(layer.bringToFront)layer.bringToFront();if(typeof showCmfSheet==='function')showCmfSheet(feature,e?.latlng);else layer.bindPopup('Объект').openPopup(e?.latlng);});
 };
 window.clearCmfSelection=resetSelection;
})();
