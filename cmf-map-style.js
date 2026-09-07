/* CarryMap-like styling, forestry labels and selection for decoded CMF2 geometry. */
(function(){
 let selected=null;
 function layerName(f){return String(f?.properties?.CMF_LAYER||'').toLowerCase()}
 function isStand(f){return /выдпород|выдел/.test(layerName(f))}
 function isWater(f){return /воды|берега|вод/.test(layerName(f))}
 function isRoad(f){return /дороги|дорог/.test(layerName(f))}
 function isQuarter(f){return /квпрос|кварт/.test(layerName(f))}
 function isLandBorder(f){return /грзем/.test(layerName(f))}
 function normalStyle(f){const t=String(f?.geometry?.type||'');if(isRoad(f))return{color:'#ff2b2b',weight:3.4,opacity:1,fillOpacity:0};if(isWater(f))return{color:'#35b6ff',weight:2.6,opacity:1,fillColor:'#35b6ff',fillOpacity:t.includes('Polygon')?.38:0};if(isQuarter(f)||isLandBorder(f))return{color:'#126dff',weight:isQuarter(f)?3.5:2.8,opacity:1,fillOpacity:0};if(isStand(f))return{color:'#22bd45',weight:2.35,opacity:1,fillColor:'#22bd45',fillOpacity:.025};if(t.includes('Line'))return{color:'#d7e5dc',weight:1.8,opacity:.9,fillOpacity:0};if(t.includes('Polygon'))return{color:'#22bd45',weight:1.8,opacity:.95,fillColor:'#22bd45',fillOpacity:.025};return{weight:2,fillOpacity:.7}}
 function selectedStyle(f){const s=normalStyle(f),poly=String(f?.geometry?.type||'').includes('Polygon');return{...s,color:poly?'#dfff00':'#ffd400',weight:Math.max(4.5,(s.weight||2)+2),opacity:1,fillColor:poly?'#e8f20a':(s.fillColor||'#ffd400'),fillOpacity:poly?.34:s.fillOpacity}}
 function read(p,names){for(const n of names)if(p?.[n]!==undefined&&p[n]!==null&&p[n]!=='')return p[n];return null}
 function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function standLabel(f){const p=f?.properties||{},v=read(p,['Nвыд','NВЫД','Выдел','VD']);return v==null?'':safe(v)}
 function quarterLabel(f){const p=f?.properties||{},q=read(p,['Nкварт','NКВАРТ','Квартал','KV']),a=read(p,['Площ','Площадь','PL','Площ_геом']);if(q==null&&a==null)return'';const qs=q==null?'':safe(q),as=a==null?'':safe(String(a).replace('.',','));return `<div class="quarterLabelBox">${qs?`<b>${qs}</b>`:''}${as?`<span>${as}</span>`:''}</div>`}
 function resetSelection(){if(selected?.layer?.setStyle)selected.layer.setStyle(normalStyle(selected.feature));selected=null;window.__cmfSelectedLayer=null}
 window.styleImportedFeature=normalStyle;
 window.bindImportedFeature=function(feature,layer){if(isStand(feature)&&layer.bindTooltip){const txt=standLabel(feature);if(txt)layer.bindTooltip(txt,{permanent:true,direction:'center',className:'standPermanentLabel',interactive:false})}else if(isQuarter(feature)&&layer.bindTooltip){const html=quarterLabel(feature);if(html)layer.bindTooltip(html,{permanent:true,direction:'center',className:'quarterPermanentLabel',interactive:false})}layer.on('click',e=>{resetSelection();selected={feature,layer};window.__cmfSelectedLayer=layer;if(layer.setStyle)layer.setStyle(selectedStyle(feature));if(layer.bringToFront)layer.bringToFront();if(typeof showCmfSheet==='function')showCmfSheet(feature,e?.latlng,layer);else layer.bindPopup('Объект').openPopup(e?.latlng)})};
 window.clearCmfSelection=resetSelection;
})();