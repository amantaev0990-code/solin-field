/* Legacy JSON backup recovery regression (not a user-visible field handoff): export an archived backup in
 * iOS-style web, import it through native APK's Transfer input in a fresh
 * isolated browser profile. Then compare forest, stands, Maket10. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),
 {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..');
function serve(dir,port){
 const server=http.createServer((req,res)=>{try{
  const url=decodeURIComponent(req.url.split('?')[0]),p=path.resolve(dir,'.'+url);
  if(!p.startsWith(dir+path.sep)&&p!==dir){res.writeHead(403);return res.end();}
  const file=fs.statSync(p).isDirectory()?path.join(p,'index.html'):p;
  const ext=path.extname(file),type={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.gz':'application/gzip','.wasm':'application/wasm'}[ext]||'application/octet-stream';
  res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));
 }catch(e){res.writeHead(404);res.end();}});
 return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)));
}
(async()=>{let browser,a,b;
 try{
  a=await serve(root,8182);b=await serve(path.join(root,'www'),8183);
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const source=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'}),
   target=await browser.newContext({serviceWorkers:'block'});
  const original=await source.newPage(),apk=await target.newPage();
  await original.goto('http://127.0.0.1:8182/');
  await original.waitForFunction(()=>window.SolinWorkspace&&typeof D!=='undefined'&&D?.quarters);
  await original.evaluate(()=>SolinWorkspace.ready);
  const baseline=await original.evaluate(async()=>{
   const f=(await SolinWorkspace.list())[0];
   await SolinWorkspace.activate(f.id);
   // Full original forest, including all children and Maket10. Nothing is
   // fabricated or manually synchronized between browsers.
   return {id:f.id,count:Object.keys(D.quarters).length,
    stands:Object.values(D.quarters).reduce((n,q)=>n+q.compartments.length,0),
    sample:D.quarters[Object.keys(D.quarters)[0]].compartments[0]?.VD};
  });
  await original.evaluate(()=>show('menuScreen'));
  const [dl]=await Promise.all([
   original.waitForEvent('download'),
   original.evaluate(()=>SolinWorkspace.exportForest())
  ]);
  assert.match(dl.suggestedFilename(),/^SOLIN-Field-\d+-\d+-/);
  const bytes=fs.readFileSync(await dl.path()),backup=JSON.parse(bytes.toString('utf8'));
  assert.equal(backup.format,'SOLIN-Field-Backup-v2');
  assert.equal(backup.quarters&&Object.keys(backup.quarters).length,baseline.count);
  await apk.goto('http://127.0.0.1:8183/');
  await apk.waitForFunction(()=>window.SolinWorkspace&&typeof D!=='undefined'&&D?.quarters);
  await apk.evaluate(()=>SolinWorkspace.ready);
  await apk.locator('#transferForestInput').setInputFiles({name:dl.suggestedFilename(),mimeType:'application/json',buffer:bytes});
  await apk.locator('#acceptTransfer').waitFor({timeout:45000});
  await apk.locator('#acceptTransfer').click();
  await apk.waitForFunction(async id=>{
   const found=(await SolinWorkspace.list()).find(x=>x.id===id);
   return !!found&&Object.keys(found.quarters).length>0;
  },baseline.id,{timeout:45000});
  const imported=await apk.evaluate(async id=>{
   await SolinWorkspace.activate(id);
   const f=(await SolinWorkspace.list()).find(x=>x.id===id);
   return {id:f.id,count:Object.keys(D.quarters).length,
    stands:Object.values(D.quarters).reduce((n,q)=>n+q.compartments.length,0),
    rows:Object.values(D.quarters).flatMap(q=>q.compartments||[]).map(r=>({
     KV:r.KV,VD:r.VD,KGLF:r.KGLF,PLV:r.PLV,M3Pr:r.M3Pr,
     M3B:r.M3B,Maket10:(r._children?.Макет10||[]).length}))};
  },baseline.id);
  const originalRows=Object.values(backup.quarters).flatMap(q=>q.compartments||[]).map(r=>({
   KV:r.KV,VD:r.VD,KGLF:r.KGLF,PLV:r.PLV,M3Pr:r.M3Pr,
   M3B:r.M3B,Maket10:(r._children?.Макет10||[]).length}));
  assert.equal(imported.id,baseline.id);
  assert.equal(imported.count,baseline.count);
  assert.equal(imported.stands,baseline.stands);
  assert.deepEqual(imported.rows,originalRows,'Every stand, source species, bonitet and Maket10 row must survive web → APK migration');
  console.log('LEGACY_JSON_RECOVERY_OK: hidden backup compatibility preserved; all quarters/stands and Maket10 survive');
  await source.close();await target.close();
 }finally{await browser?.close();for(const s of [a,b])if(s)await new Promise(r=>s.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
