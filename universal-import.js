/* Universal engineer map import: format detection by bytes/name; KMZ and GPX to GeoJSON. */
(function(){
 function ext(n){return (String(n).toLowerCase().match(/\.([^.]+)$/)||[])[1]||''}
 async function head(file,n=32){return new Uint8Array(await file.slice(0,n).arrayBuffer())}
 function ascii(u){return Array.from(u).map(x=>String.fromCharCode(x)).join('')}
 async function detect(file){
  const e=ext(file.name),h=await head(file,32),s=ascii(h);
  if(s.slice(0,4)==='CMF2')return 'cmf2';
  if(s.slice(0,16)==='SQLite format 3\0')return e==='mbtiles'?'mbtiles':'gpkg';
  if(h[0]===0x50&&h[1]===0x4b)return e==='kmz'?'kmz':'zip';
  if(e==='kml')return 'kml'; if(e==='gpx')return 'gpx';
  if(e==='geojson'||e==='json')return 'geojson'; if(e==='shp')return 'shp';
  const t=await file.slice(0,256).text();
  if(/<kml[\s>]/i.test(t))return 'kml'; if(/<gpx[\s>]/i.test(t))return 'gpx';
  if(/^\s*[\[{]/.test(t))return 'geojson'; return e||'unknown';
 }
 function gpxToGeoJSON(text){
  const xml=new DOMParser().parseFromString(text,'text/xml');if(xml.querySelector('parsererror'))throw new Error('Повреждённый GPX');const fs=[];
  xml.querySelectorAll('wpt').forEach(n=>{const lon=+n.getAttribute('lon'),lat=+n.getAttribute('lat');if(Number.isFinite(lon)&&Number.isFinite(lat))fs.push({type:'Feature',properties:gpxProps(n),geometry:{type:'Point',coordinates:[lon,lat]}})});
  xml.querySelectorAll('trk').forEach(t=>{const segs=[...t.querySelectorAll('trkseg')].map(seg=>[...seg.querySelectorAll('trkpt')].map(p=>[+p.getAttribute('lon'),+p.getAttribute('lat')]).filter(a=>a.every(Number.isFinite))).filter(a=>a.length>1);if(segs.length)fs.push({type:'Feature',properties:gpxProps(t),geometry:segs.length===1?{type:'LineString',coordinates:segs[0]}:{type:'MultiLineString',coordinates:segs}})});
  xml.querySelectorAll('rte').forEach(r=>{const c=[...r.querySelectorAll('rtept')].map(p=>[+p.getAttribute('lon'),+p.getAttribute('lat')]).filter(a=>a.every(Number.isFinite));if(c.length>1)fs.push({type:'Feature',properties:gpxProps(r),geometry:{type:'LineString',coordinates:c}})});
  return {type:'FeatureCollection',features:fs};
 }
 function gpxProps(n){const p={};['name','desc','cmt','type','sym'].forEach(k=>{const v=n.querySelector(':scope > '+k)?.textContent?.trim();if(v)p[k]=v});return p}
 async function kmzToKml(file){if(!window.JSZip)throw new Error('Модуль KMZ не загрузился');const z=await JSZip.loadAsync(await file.arrayBuffer());const names=Object.keys(z.files).filter(n=>/\.kml$/i.test(n));if(!names.length)throw new Error('В KMZ нет KML');return await z.files[names[0]].async('text')}
 window.SolinMapImport={detect,gpxToGeoJSON,kmzToKml};
})();