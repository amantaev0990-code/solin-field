/* CMF2 browser decoder v2: structural metadata + exact file extent. No fabricated layer geometry. */
(function(){
  function asciiAt(u8,off,len){let s='';for(let i=off;i<Math.min(u8.length,off+len);i++)s+=String.fromCharCode(u8[i]);return s}
  function findAscii(u8,needle){const n=[...needle].map(c=>c.charCodeAt(0)),out=[];outer:for(let i=0;i<=u8.length-n.length;i++){for(let j=0;j<n.length;j++)if(u8[i+j]!==n[j])continue outer;out.push(i)}return out}
  function utm40ToWgs84(easting,northing){
    const a=6378137,eccSquared=0.00669438,k0=0.9996,lonOrigin=57;
    const eccPrimeSquared=eccSquared/(1-eccSquared),M=northing/k0,mu=M/(a*(1-eccSquared/4-3*eccSquared*eccSquared/64-5*Math.pow(eccSquared,3)/256));
    const e1=(1-Math.sqrt(1-eccSquared))/(1+Math.sqrt(1-eccSquared));
    const phi1Rad=mu+(3*e1/2-27*Math.pow(e1,3)/32)*Math.sin(2*mu)+(21*e1*e1/16-55*Math.pow(e1,4)/32)*Math.sin(4*mu)+(151*Math.pow(e1,3)/96)*Math.sin(6*mu);
    const N1=a/Math.sqrt(1-eccSquared*Math.sin(phi1Rad)*Math.sin(phi1Rad)),T1=Math.tan(phi1Rad)*Math.tan(phi1Rad),C1=eccPrimeSquared*Math.cos(phi1Rad)*Math.cos(phi1Rad),R1=a*(1-eccSquared)/Math.pow(1-eccSquared*Math.sin(phi1Rad)*Math.sin(phi1Rad),1.5),D=(easting-500000)/(N1*k0);
    const lat=phi1Rad-(N1*Math.tan(phi1Rad)/R1)*(D*D/2-(5+3*T1+10*C1-4*C1*C1-9*eccPrimeSquared)*Math.pow(D,4)/24+(61+90*T1+298*C1+45*T1*T1-252*eccPrimeSquared-3*C1*C1)*Math.pow(D,6)/720);
    const lon=(D-(1+2*T1+C1)*Math.pow(D,3)/6+(5-2*C1+28*T1-3*C1*C1+8*eccPrimeSquared+24*T1*T1)*Math.pow(D,5)/120)/Math.cos(phi1Rad);
    return [lat*180/Math.PI,lonOrigin+lon*180/Math.PI]
  }
  function readKnownExtent(view){
    if(view.byteLength<2168)return null;
    const vals=[2126,2138,2150,2162].map(o=>view.getFloat64(o,true));
    const [xmin,ymin,xmax,ymax]=vals;
    if(!(xmin>100000&&xmin<900000&&xmax>xmin&&ymin>4000000&&ymin<7000000&&ymax>ymin))return null;
    const sw=utm40ToWgs84(xmin,ymin),ne=utm40ToWgs84(xmax,ymax);
    return {utm:{xmin,ymin,xmax,ymax},wgs84:{south:sw[0],west:sw[1],north:ne[0],east:ne[1]}}
  }
  async function decode(file){
    const buf=await file.arrayBuffer(),u8=new Uint8Array(buf),view=new DataView(buf);
    if(u8.length<4||asciiAt(u8,0,4)!=='CMF2')throw new Error('Это не файл CMF2');
    const utf8=new TextDecoder('utf-8',{fatal:false}).decode(u8),utf16=new TextDecoder('utf-16le',{fatal:false}).decode(u8),hay=utf8+'\n'+utf16;
    const known=(window.cmf2Layers||[]).filter(x=>hay.includes(x.source));
    const generic=[...new Set((hay.match(/[\wА-Яа-яЁё]+(?:_[\wА-Яа-яЁё]+){1,8}_(?:region|polyline|text|point)/g)||[]))].slice(0,100);
    const layers=known.length?known:generic.map(source=>({source,name:source,type:''}));
    const proj=(hay.match(/\+proj=utm[^\x00\r\n]{0,180}/)||[])[0]?.trim()||'';
    return {layers,projection:proj||'UTM',pstgBlocks:findAscii(u8,'PSTG').length,sqliteHeaders:findAscii(u8,'SQLite format 3').length,extent:readKnownExtent(view),size:u8.length};
  }
  window.inspectCmf2=decode;

  function removeAccept(){const i=document.getElementById('mapFileInput');if(i)i.removeAttribute('accept')}
  window.addEventListener('DOMContentLoaded',()=>setTimeout(removeAccept,0));
  const oldEnsure=window.ensureMapFileUi;
  if(typeof oldEnsure==='function')window.ensureMapFileUi=function(){oldEnsure();removeAccept()};

  const oldHandle=window.handleMapFiles;
  if(typeof oldHandle==='function')window.handleMapFiles=async function(input){
    const all=[...(input?.files||[])];
    const cmfs=all.filter(f=>/\.cmf2$/i.test(f.name));
    const rest=all.filter(f=>!/\.cmf2$/i.test(f.name));
    for(const file of cmfs){
      try{
        const info=await decode(file);
        const key=`${file.name}|${file.size}|${file.lastModified}`;
        let entry=(window.importedMapLayers||[]).find(x=>x.cmf2&&x.key===key);
        if(!entry){
          entry={name:file.name,cmf2:true,key,count:info.layers.length,projection:info.projection,visible:true,info};
          if(info.extent?.wgs84&&window.L&&window.fieldMap){
            const e=info.extent.wgs84,b=[[e.south,e.west],[e.north,e.east]];
            entry.layer=L.rectangle(b,{weight:2,fillOpacity:0,dashArray:'7 6',interactive:false}).addTo(fieldMap);
            fieldMap.fitBounds(b,{padding:[12,12]});
          }
          window.importedMapLayers?.push(entry);
        }else if(entry.info?.extent?.wgs84&&window.fieldMap){
          const e=entry.info.extent.wgs84;fieldMap.fitBounds([[e.south,e.west],[e.north,e.east]],{padding:[12,12]});
        }
        if(typeof window.toast==='function')toast(`CMF2: ${info.layers.length} слоёв · территория найдена`);
      }catch(e){console.error(e);if(typeof window.toast==='function')toast(`${file.name}: ${e.message||'ошибка CMF2'}`)}
    }
    if(rest.length&&oldHandle){const dt=new DataTransfer();rest.forEach(f=>dt.items.add(f));const fake={files:dt.files,value:''};await oldHandle(fake)}
    if(typeof window.renderMapLayerList==='function')renderMapLayerList();
    if(input)input.value='';
  };
})();
