/* CMF2 local diagnostics. Does not alter geometry or attributes. */
(function(){
 function compact(info,file){
   const stand=(info?.geometryLayers||[]).find(g=>/выдпород|выдел/i.test(g.source||''));
   const fs=stand?.geojson?.features||[];
   const labeled=fs.filter(f=>f?.properties?.Nкварт!=null&&f?.properties?.Nвыд!=null).length;
   return {
     file:{name:file?.name||'',size:file?.size||0,lastModified:file?.lastModified||0},
     decoder:{
       decodedFeatures:info?.decodedFeatures||0,decodedVertices:info?.decodedVertices||0,zone:info?.zone||null,
       universalFallback:!!info?.universalFallback,framedSpatial:!!info?.framedSpatial,framedSingleRecovery:!!info?.framedSingleRecovery,
       legacyRescue:!!info?.legacyRescue,adaptiveRescue:!!info?.adaptiveRescue,adaptiveRealigned:!!info?.adaptiveRealigned,
       adaptiveRealignChanged:info?.adaptiveRealignChanged||0,attributeRecoveryV2:!!info?.attributeRecoveryV2,
       attributeRecoveryCount:info?.attributeRecoveryCount||0,attributesDecoded:!!info?.attributesDecoded
     },
     adaptive:info?.adaptiveDiagnostics||null,
     layers:(info?.geometryLayers||[]).map(g=>({index:g.index,source:g.source,type:g.type,count:g.count||0,vertices:g.totalVertices||0,start:g.start??null,chunkCount:g.chunkCount||1,rawLz4:!!g.rawLz4,framedLz4:!!g.framedLz4,extentOffset:g.extent?.offset??null,extentKind:g.extent?.kind||null,utm:g.extent?.utm||null})),
     stand:{count:fs.length,labeled,examples:fs.slice(0,5).map(f=>({q:f?.properties?.Nкварт??null,v:f?.properties?.Nвыд??null,key:f?.properties?.['Ключ']??null}))}
   };
 }
 function installDecoder(){
   if(typeof window.inspectCmf2!=='function'||window.inspectCmf2._diagWrapped)return false;
   const orig=window.inspectCmf2;
   const wrapped=async file=>{const info=await orig(file);try{info.cmfDiagnostics=compact(info,file);console.log('SOLI-N CMF2 DIAGNOSTICS',info.cmfDiagnostics)}catch(e){console.warn('CMF diagnostics',e)}return info};
   wrapped._diagWrapped=true;window.inspectCmf2=wrapped;return true;
 }
 if(!installDecoder())setTimeout(installDecoder,0);
 window.copyCmfDiagnostics=async function(index){
   const e=window.importedMapLayers?.[index]||((typeof importedMapLayers!=='undefined')?importedMapLayers[index]:null),d=e?.info?.cmfDiagnostics;
   if(!d)return;
   const text=JSON.stringify(d,null,2);
   try{await navigator.clipboard.writeText(text);if(typeof toast==='function')toast('Диагностика CMF2 скопирована')}catch(_){prompt('Скопируйте диагностику CMF2',text)}
 };
 function installRender(){
   if(typeof window.renderMapLayerList!=='function'||window.renderMapLayerList._diagWrapped)return false;
   const orig=window.renderMapLayerList;
   const wrapped=function(){const r=orig();try{const box=document.getElementById('mapLayerList');if(!box)return r;for(let i=0;i<importedMapLayers.length;i++){const e=importedMapLayers[i];if(!e?.cmf2||!e?.info?.cmfDiagnostics)continue;const id='cmfDiagBtn'+i;if(document.getElementById(id))continue;const b=document.createElement('button');b.id=id;b.className='mapMode';b.style.margin='8px 0';b.textContent='Скопировать диагностику CMF2';b.onclick=()=>copyCmfDiagnostics(i);box.prepend(b)}}catch(e){console.warn('CMF diagnostics UI',e)}return r};
   wrapped._diagWrapped=true;window.renderMapLayerList=wrapped;return true;
 }
 if(!installRender())setTimeout(installRender,0);
})();
