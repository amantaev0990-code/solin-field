/* CMF2 MapInfo-style labels + robust attribute recovery. */
(function(){
  let sqlPromise=null;
  async function getSql(){
    if(window.SQL?.Database)return window.SQL;
    if(!window.initSqlJs)return null;
    if(!sqlPromise)sqlPromise=window.initSqlJs({locateFile:f=>'https://unpkg.com/sql.js@1.10.3/dist/'+f});
    return sqlPromise;
  }
  function rows(res){if(!res?.length)return[];const c=res[0].columns;return res[0].values.map(v=>Object.fromEntries(c.map((k,i)=>[k,v[i]])))}
  function standLayer(info){return(info?.geometryLayers||[]).find(g=>/выдпород|выдел/i.test(g.source||''))}
  async function recoverAttrs(file,info){
    const stand=standLayer(info); if(!stand)return info;
    if(stand.geojson?.features?.some(f=>f.properties?.Nкварт!=null&&f.properties?.Nвыд!=null))return info;
    const block=(info.blocks||[]).find(b=>b.layer===stand.source)||(info.blocks||[])[stand.index]||(info.blocks||[])[0];
    if(block?.offset==null||!window.SolinCmfRuntime?.rebuildPageStorage)return info;
    try{
      const raw=new Uint8Array(await file.arrayBuffer());
      const dbBytes=window.SolinCmfRuntime.rebuildPageStorage(raw,block.offset); if(!dbBytes)return info;
      const S=await getSql(); if(!S)return info;
      const db=new S.Database(dbBytes);
      let rr=[];
      try{rr=rows(db.exec('select rowid as __rowid__, * from idx'))}catch(_){rr=[]}
      try{db.close()}catch(_){}
      if(!rr.length)return info;
      const feats=stand.geojson.features||[];
      for(let i=0;i<Math.min(rr.length,feats.length);i++){
        const r=rr[i],f=feats[i];
        for(const[k,v]of Object.entries(r))if(k!=='__rowid__'&&v!==null&&v!==undefined&&v!=='')f.properties[k]=v;
        const key=String(r['Ключ']??r.KEY??r.Key??'');
        if(/^\d+_\d+/.test(key)){const [q,v]=key.split('_');f.properties.Nкварт=Number(q);f.properties.Nвыд=Number(v)}
        if(f.properties.Nкварт==null){const q=r.Nкварт??r.NКВАРТ??r.KV??r['Квартал'];if(q!==undefined&&q!=='')f.properties.Nкварт=Number(q)||q}
        if(f.properties.Nвыд==null){const v=r.Nвыд??r.NВЫД??r.VD??r['Выдел'];if(v!==undefined&&v!=='')f.properties.Nвыд=Number(v)||v}
      }
      info.attributesDecoded=true;
    }catch(e){console.warn('CMF label attribute recovery',e)}
    return info;
  }
  const installDecoderWrap=()=>{
    if(typeof window.inspectCmf2!=='function'||window.inspectCmf2._labelRecoveryWrapped)return;
    const original=window.inspectCmf2;
    const wrapped=async file=>recoverAttrs(file,await original(file));
    wrapped._labelRecoveryWrapped=true;
    window.inspectCmf2=wrapped;
  };
  installDecoderWrap(); setTimeout(installDecoderWrap,0);

  function prop(p,names){for(const n of names)if(p?.[n]!==undefined&&p[n]!==null&&p[n]!=='')return p[n];return null}
  function geomArea(f){const a=prop(f.properties,['Площ','PL','Площадь','Площ_геом']);return Number(a)||0}
  function featureBounds(f){try{return L.geoJSON(f).getBounds()}catch(_){return null}}
  function labelIcon(html,cls){return L.divIcon({className:cls,html,iconSize:null,iconAnchor:[0,0]})}
  function buildLabels(entry){
    if(!entry?.cmf2||entry._cmfLabelsBuilt)return;
    const stand=(entry.geometryEntries||[]).find(g=>/выдпород|выдел/i.test(g.source||''));
    const feats=stand?.layer?._layers?Object.values(stand.layer._layers).map(x=>x.feature).filter(Boolean):(stand?.geojson?.features||[]);
    if(!feats?.length)return;
    const qGroup=L.layerGroup(),vGroup=L.layerGroup(),quarters=new Map(); let vCount=0;
    for(const f of feats){
      const p=f.properties||{},q=prop(p,['Nкварт','NКВАРТ','KV','Квартал']),v=prop(p,['Nвыд','NВЫД','VD','Выдел']);
      const b=featureBounds(f); if(!b?.isValid())continue;
      if(v!=null){L.marker(b.getCenter(),{interactive:false,icon:labelIcon(`<span>${String(v)}</span>`,'cmfStandNoIcon')}).addTo(vGroup);vCount++}
      if(q!=null){const key=String(q);let x=quarters.get(key);if(!x){x={bounds:L.latLngBounds(b),area:0};quarters.set(key,x)}else x.bounds.extend(b);x.area+=geomArea(f)}
    }
    for(const[q,x]of quarters){const area=Math.round(x.area);const html=`<div class="cmfQuarterNo"><b>${q}</b><i></i><span>${area||''}</span></div>`;L.marker(x.bounds.getCenter(),{interactive:false,icon:labelIcon(html,'cmfQuarterNoIcon')}).addTo(qGroup)}
    entry.labelLayers={quarters:qGroup,stands:vGroup,quartersVisible:true,standsVisible:true,qCount:quarters.size,vCount};
    qGroup.addTo(fieldMap);vGroup.addTo(fieldMap);entry._cmfLabelsBuilt=true;
  }
  window.toggleCmfLabelLayer=function(index,type,on){const e=importedMapLayers[index],l=e?.labelLayers?.[type];if(!l)return;e.labelLayers[type+'Visible']=on;if(on){if(!fieldMap.hasLayer(l))l.addTo(fieldMap)}else if(fieldMap.hasLayer(l))fieldMap.removeLayer(l)};
  function addLabelRows(){
    const box=document.getElementById('mapLayerList');if(!box)return;
    importedMapLayers.forEach((e,i)=>{if(!e?.cmf2||!e.labelLayers)return;const mark='cmf-label-controls-'+i;if(document.getElementById(mark))return;const wrap=document.createElement('div');wrap.id=mark;wrap.className='cmfLabelControls';wrap.innerHTML=`<label class="mapLayerRow"><input type="checkbox" checked onchange="toggleCmfLabelLayer(${i},'quarters',this.checked)"><span>T</span><span><b>Ном кв</b><small>${e.labelLayers.qCount} подписей кварталов</small></span></label><label class="mapLayerRow"><input type="checkbox" checked onchange="toggleCmfLabelLayer(${i},'stands',this.checked)"><span>T</span><span><b>Ном Выд</b><small>${e.labelLayers.vCount} подписей выделов</small></span></label>`;box.prepend(wrap)})
  }
  const installRenderWrap=()=>{
    if(typeof window.renderMapLayerList!=='function'||window.renderMapLayerList._labelWrapped)return;
    const original=window.renderMapLayerList;
    const wrapped=function(){for(const e of importedMapLayers)buildLabels(e);const r=original();addLabelRows();return r};
    wrapped._labelWrapped=true;window.renderMapLayerList=wrapped;
  };
  installRenderWrap();setTimeout(installRenderWrap,0);
})();