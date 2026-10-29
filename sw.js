const CACHE='solin-field-20261029-1';
const CORE=["./solin-control-source-recovery.js","./solin-control-source-recovery.json.gz","./solin-access-sql.js","./solin-native-control-data.js","./solin-native-control-runtime.js","./solin-native-control-engine.js","./solin-control-worker.js","./solin-control-norms.json.gz", "./solin-access-expression.js", "./solin-control-data.js", "./solin-control-engine.js", "./solin-control-ui.js", "./solin-control.css", "./solin-card-editor.js", "./solin-card-editor.css", "./solin-card-assist.js", "./solin-card-assist.css", "./manifest.webmanifest", "./styles.css", "./ui-patch.css", "./vendor/leaflet.css", "./map.css", "./map-fullscreen.css", "./cmf-popup-carry.css", "./static-ui.css", "./solin-workflow.css", "./solin-readable.css", "./solin-workspace.css", "./vendor/leaflet.js", "./vendor/geopackage.min.js", "./vendor/jszip.min.js", "./vendor/sql-wasm.js", "./app.js", "./ui-patch.js", "./transfer-export.js", "./gpkg-loader.js", "./universal-import.js", "./map.js", "./map-fullscreen.js", "./cmf2-structural-v4.js", "./cmf-runtime.js", "./cmf-pstg-v5.js", "./cmf-attrs-v5.js", "./cmf-inline-key-v6.js", "./cmf-inline-attrs-v7.js", "./map-info.js", "./cmf-popup-bind-fix.js", "./cmf-map-style.js", "./cmf-label-layer.js", "./cmf-diagnostics.js", "./static-ui.js", "./solin-enhancements.js", "./solin-workflow.js", "./solin-audit-data.js", "./solin-sql-source.js", "./solin-named-controls.js", "./solin-mdb-bridge.js", "./solin-apk-mdb.js", "./solin-browser-mdb.js", "./solin-browser-mdb-v29.js", "./solin-mdb-wasm-entry.js", "./windows/Build-SOLIN-Transfer-MDB.ps1", "./solin-field-core.js", "./solin-transfer-reader.js", "./solin-workspace.js", "./solin-dictionary.js", "./solin-readable.js", "./solin-usability.js", "./index.html", "./data-meta.json", "./data-manifest.json", "./refs-audit.json.gz", "./vendor/mdb-reader.bundle.js", "./vendor/sql-wasm.wasm", "./quarters/q1.json", "./quarters/q2.json", "./quarters/q3.json", "./quarters/q4.json", "./quarters/q5.json", "./quarters/q6.json", "./quarters/q7.json", "./quarters/q8.json", "./quarters/q9.json", "./quarters/q10.json"];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(CORE);await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('solin-field-')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
// Critical fix: never let an old cache-first SW mask an updated index or
// exporter script merely because it has the same pathname. Still work offline
// by falling back to the current/pre-cached response if the network is down.
self.addEventListener('fetch', e => {
  const r=e.request, u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==self.location.origin)return;
  if(r.headers.has('range')||/\.jar$/i.test(u.pathname))return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const dynamic=r.mode==='navigate'||u.pathname.includes('/mdb-wasm-poc/')||u.pathname.endsWith('/solin-mdb-wasm-entry.js')||u.pathname.endsWith('/solin-card-editor.js')||u.pathname.endsWith('/solin-card-assist.js')||u.pathname.endsWith('/solin-card-editor.css')||u.pathname.endsWith('/solin-card-assist.css')||/(?:index|export-v29)\.html$|\/solin-(?:browser-mdb(?:-v29)?|transfer-reader|mdb-bridge|apk-mdb)\.js$/.test(u.pathname);
    if(dynamic) {
      try {
        const network=await fetch(r,{cache:'no-store'});
        if(network.ok){await c.put(r,network.clone());return network;}
      }catch(_){}
    }
    const saved=await c.match(r,{ignoreSearch:!dynamic});
    if(saved)return saved;
    try{
      const network=await fetch(r);
      if(network.ok)await c.put(r,network.clone());
      return network;
    }catch(error){
      if(r.mode==='navigate')return c.match('./index.html');
      throw error;
    }
  })());
});
