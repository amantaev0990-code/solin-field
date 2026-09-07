/* Universal CMF2 structure reader. Reads real metadata from arbitrary CMF2 files; never fabricates geometry. */
(function(){
 function asciiAt(u8,o,n){let s='';for(let i=o;i<Math.min(u8.length,o+n);i++)s+=String.fromCharCode(u8[i]);return s}
 function findAscii(u8,needle){const n=[...needle].map(c=>c.charCodeAt(0)),out=[];outer:for(let i=0;i<=u8.length-n.length;i++){for(let j=0;j<n.length;j++)if(u8[i+j]!==n[j])continue outer;out.push(i)}return out}
 function utmToWgs84(easting,northing,zone,southHemisphere=false){const a=6378137,e2=.00669438,k0=.9996,ep=e2/(1-e2);if(southHemisphere)northing-=10000000;const M=northing/k0,mu=M/(a*(1-e2/4-3*e2*e2/64-5*Math.pow(e2,3)/256)),e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2)),p=mu+(3*e1/2-27*Math.pow(e1,3)/32)*Math.sin(2*mu)+(21*e1*e1/16-55*Math.pow(e1,4)/32)*Math.sin(4*mu)+(151*Math.pow(e1,3)/96)*Math.sin(6*mu),N=a/Math.sqrt(1-e2*Math.sin(p)**2),T=Math.tan(p)**2,C=ep*Math.cos(p)**2,R=a*(1-e2)/Math.pow(1-e2*Math.sin(p)**2,1.5),D=(easting-500000)/(N*k0),lat=p-(N*Math.tan(p)/R)*(D**2/2-(5+3*T+10*C-4*C*C-9*ep)*D**4/24+(61+90*T+298*C+45*T*T-252*ep-3*C*C)*D**6/720),lon=(D-(1+2*T+C)*D**3/6+(5-2*C+28*T-3*C*C+8*ep+24*T*T)*D**5/120)/Math.cos(p),origin=(zone-1)*6-180+3;return[lat*180/Math.PI,origin+lon*180/Math.PI]}
 function niceName(source){return source.replace(/^(?:\d+_)+/,'').replace(/_(region|polyline|text|point)$/i,'').replace(/_/g,' ')}
 function layerNames(hay){const rx=/[0-9A-Za-zА-Яа-яЁё .()\-]{1,96}_(?:region|polyline|text|point)\b/g;return[...new Set(hay.match(rx)||[])].map((source,index)=>{const type=source.match(/_(region|polyline|text|point)$/i)?.[1]?.toLowerCase()||'';return{index,source,name:niceName(source),type}}).slice(0,500)}
 function readExtent(view,zone,south){if(view.byteLength<2168||!zone)return null;const [xmin,ymin,xmax,ymax]=[2126,2138,2150,2162].map(o=>view.getFloat64(o,true));if(!(xmin>100000&&xmin<900000&&xmax>xmin&&ymin>0&&ymax>ymin))return null;const sw=utmToWgs84(xmin,ymin,zone,south),ne=utmToWgs84(xmax,ymax,zone,south);return{utm:{xmin,ymin,xmax,ymax},wgs84:{south:Math.min(sw[0],ne[0]),west:Math.min(sw[1],ne[1]),north:Math.max(sw[0],ne[0]),east:Math.max(sw[1],ne[1])}}}
 function storageBlocks(u8,layers){const pstg=findAscii(u8,'PSTG'),sqlite=findAscii(u8,'SQLite format 3');return pstg.map((offset,i)=>({index:i,offset,sqliteOffset:sqlite.find(x=>x>offset&&(i===pstg.length-1||x<pstg[i+1]))??null,layer:layers[i]?.source||null}))}
 function schemaHints(hay){const known=['FID_','gShape_','Лесничество','Леснич','КатЗащ','Nкварт','Nвыд','Площ','КатЗем','Бонитет','Тип_леса','Порода','Тон','ХозРасп'];return known.filter(x=>hay.includes(x))}
 async function decode(file){
  const buf=await file.arrayBuffer(),u8=new Uint8Array(buf),view=new DataView(buf);
  if(u8.length<4||asciiAt(u8,0,4)!=='CMF2')throw new Error('Это не CMF2');
  const a=new TextDecoder('utf-8',{fatal:false}).decode(u8),b=new TextDecoder('utf-16le',{fatal:false}).decode(u8),hay=a+'\n'+b;
  const projection=(hay.match(/\+proj=utm[^\x00\r\n]{0,220}/)||[])[0]?.trim()||'';
  const zone=Number((projection.match(/\+zone=(\d+)/)||[])[1])||null,south=/\+south\b/.test(projection);
  const layers=layerNames(hay),blocks=storageBlocks(u8,layers);
  return{format:'CMF2',layers,projection:projection||'CMF2',zone,south,pstgBlocks:blocks.length,sqliteHeaders:findAscii(u8,'SQLite format 3').length,blocks,fields:schemaHints(hay),extent:readExtent(view,zone,south),size:u8.length};
 }
 window.inspectCmf2=decode;
})();
