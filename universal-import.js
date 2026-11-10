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
async function readMapInfoZip(file, openDecoder = loadMapInfoDecoder) {
 const maxBytes = 64 * 1024 * 1024;
 if (file.size > maxBytes) throw Error('ZIP MapInfo больше 64 МБ');
 const zip = await JSZip.loadAsync(await file.arrayBuffer());
 const files = new Map();
 let totalBytes = 0;
 for (const entry of Object.values(zip.files)) {
  if (entry.dir || !/\.(wor|tab|dat|map|id)$/i.test(entry.name)) continue;
  if (entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name) {
   throw Error('Недопустимый путь внутри ZIP');
  }
  const key = entry.name.toLowerCase();
  if (files.has(key)) throw Error('В ZIP повторяются имена файлов');
  totalBytes += entry._data.uncompressedSize;
  if (!Number.isFinite(totalBytes) || totalBytes > maxBytes || files.size >= 512) {
   throw Error('Слишком большой комплект MapInfo');
  }
  files.set(key, entry);
 }
 const workspaces = [...files.keys()].filter(name => name.endsWith('.wor'));
 const preferred = workspaces.filter(name => name.split('/').at(-1) === 'основа.wor');
 const candidates = preferred.length ? preferred : workspaces;
 if (candidates.length !== 1) throw Error('В ZIP должен быть один рабочий набор Основа.WOR');
 const workspace = candidates[0];
 const directory = workspace.slice(0, workspace.lastIndexOf('/') + 1);
 const bytes = await files.get(workspace).async('uint8array');
 let wor;
 try { wor = new TextDecoder('utf-8', {fatal:true}).decode(bytes); }
 catch { wor = new TextDecoder('windows-1251').decode(bytes); }
 const tables = new Map();
 for (const [, name, alias] of wor.matchAll(/^\s*Open Table\s+"([^"]+)"\s+As\s+([^\s,]+)/gim)) {
  const path = name.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\.tab$/i, '');
  if (path.startsWith('/') || path.includes(':') || path.split('/').includes('..')) {
   throw Error('WOR должен ссылаться на таблицы внутри ZIP');
  }
  tables.set(alias.toLowerCase(), path);
 }
 const mapFrom = wor.match(/^\s*Map From\s+([^\r\n]+(?:\r?\n[ \t]*,[^\r\n]+)*)/im);
 const aliases = mapFrom?.[1].split(',').map(name => name.trim().toLowerCase());
 if (!aliases?.length || new Set(aliases).size !== aliases.length) throw Error('Не удалось определить порядок слоёв WOR');

 const settings = [...wor.matchAll(/^\s*Layer\s+(\d+)\s*\r?\n([\s\S]*?)(?=^\s*Layer\s+\d+\s*$|^Set Map\b|(?![\s\S]))/gim)];
 const layerSettings = new Map(settings.map(match => [Number(match[1]), match[2]]));
 const gdal = await openDecoder();
 const layers = [];
 for (const alias of aliases) {
  const path = tables.get(alias);
  if (!path) throw Error('WOR ссылается на неизвестный слой: ' + alias);
  const name = path.split('/').at(-1);
  const tableFiles = [];
  for (const extension of ['tab', 'dat', 'map', 'id']) {
   const entry = files.get((directory + path + '.' + extension).toLowerCase());
   if (!entry) throw Error('В ZIP отсутствует ' + path + '.' + extension);
   tableFiles.push(new File([await entry.async('uint8array')], name + '.' + extension));
  }
  const {datasets} = await gdal.open(tableFiles);
  const dataset = datasets.find(item => item.type === 'vector');
  try {
   const source = dataset?.info?.layers?.[0];
   if (!source?.geometryFields?.[0]?.coordinateSystem?.wkt) {
    throw Error('Не определена система координат слоя ' + name);
   }
   const identifier = source.name.replace(/"/g, '""');
   const output = await gdal.ogr2ogr(dataset, [
    '-f', 'GeoJSON', '-t_srs', 'EPSG:4326', '-lco', 'COORDINATE_PRECISION=10',
    '-dialect', 'OGRSQL', '-sql', 'SELECT *, OGR_STYLE AS solin_mapinfo_style FROM "' + identifier + '"'
   ]);
   const geojson = JSON.parse(new TextDecoder().decode(await gdal.getFileBytes(output)));
   if (geojson.type !== 'FeatureCollection') throw Error('Не прочитана геометрия слоя ' + name);
   layers.push({name, geojson, settings:layerSettings.get(layers.length + 1) || ''});
  } finally {
   for (const item of datasets) await gdal.close(item);
  }
 }
 return layers;
}

async function loadMapInfoDecoder() {
 const url = new URL('vendor/gdal/gdal3.js', document.baseURI);
 if (!window.initGdalJs) {
  await new Promise((resolve, reject) => {
   const script = document.createElement('script');
   script.src = url.href;
   script.onload = resolve;
   script.onerror = () => reject(Error('Декодер MapInfo отсутствует в этой сборке'));
   document.head.append(script);
  });
 }
 return window.initGdalJs({path:new URL('.', url).href.replace(/\/$/, ''), useWorker:false});
}

