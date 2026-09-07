/* Universal GeoPackage loader: reads every feature table and exposes it as GeoJSON. */
(function(){
 async function openGpkg(file){
  if(!window.GeoPackage) throw new Error('Модуль GeoPackage не загрузился');
  const api=window.GeoPackage.GeoPackageAPI||window.GeoPackage.GeoPackageManager||window.GeoPackage;
  if(window.GeoPackage.setSqljsWasmLocateFile) window.GeoPackage.setSqljsWasmLocateFile(f=>'https://unpkg.com/@ngageoint/geopackage@4.2.6/dist/'+f);
  const bytes=new Uint8Array(await file.arrayBuffer());
  const gp=await (api.open?api.open(bytes):window.GeoPackage.open(bytes));
  const names=gp.getFeatureTables?gp.getFeatureTables():[];
  const layers=[];
  for(const table of names){
   let fc={type:'FeatureCollection',features:[]};
   if(gp.getFeatureDao){
    const dao=gp.getFeatureDao(table);
    const rs=dao.queryForAll();
    try{
     while(rs.moveToNext()){
      const row=dao.getRow(rs);
      let feature=null;
      if(row.toGeoJSON) feature=row.toGeoJSON();
      else if(row.getGeometry){
       const g=row.getGeometry();
       if(g&&g.toGeoJSON) feature={type:'Feature',geometry:g.toGeoJSON(),properties:{}};
      }
      if(feature){
       feature.properties=feature.properties||{};
       if(row.columnNames) for(const c of row.columnNames){try{if(c!==row.geometryColumn?.name)feature.properties[c]=row.getValueWithColumnName?row.getValueWithColumnName(c):feature.properties[c]}catch(_){}}
       fc.features.push(feature);
      }
     }
    }finally{if(rs.close)rs.close()}
   }
   if(!fc.features.length&&gp.queryForGeoJSONFeaturesInTable){
    const rows=await gp.queryForGeoJSONFeaturesInTable(table);
    fc={type:'FeatureCollection',features:Array.isArray(rows)?rows:Object.values(rows||{})};
   }
   layers.push({name:table,geojson:fc,count:fc.features.length});
  }
  return {gp,layers};
 }
 window.openGeoPackageFile=openGpkg;
})();