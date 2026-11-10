const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');

// Synthetic one-point MapInfo workspace in UTM 40N.
const zip = Buffer.from('UEsDBBQAAAAIAOxlal1+1aaITQAAAFkAAAAHAAAATWFwLndvcvMvSM1TCElMyklVUArIz8wrKVZScCxWgDB5uXwTCxTcivJz4QLBqSUKvokFvFwKCj6JlalFCoYgpoKCS2ZxQU5ipYJ7UWJBRmYyLxcAUEsDBBQAAAAIAOxlal0jiGeuKAAAAEEBAAAKAAAAUG9pbnRzLmRhdGNO5uRkZGBgcGT4z4AN5CXmpkKZziDiH5o8r0JaZkVJaRFM0UgDUgBQSwMEFAAAAAgA7GVqXQi3NvkGAAAABAAAAAkAAABQb2ludHMuaWQTYWFgAABQSwMEFAAAAAgA7GVqXccCFLPrAAAAAAoAAAoAAABQb2ludHMubWFwY+DiE+UTk160bLWUlv7SlVuXb73JL64sLK/NL67sH548Z8nKBSvWLlmxVkzKklfQfOnKrUtWrN207c7evV+09UNPnLlx/PSFy9f/Hjr0k2Fogk3h7UxfGBmYILwP9rwewYwbnJwVYTSGBjYozcHAwEjQdHYmZkYGD5BKRoYMBgYOGXbfzy5ONYFxDiVx12t9GSMd5nMufvL2Zc9BqIYGCOnjADOhYs4i5Z1/3tuDhVvkHKnh51EwCmCAiYGPAT2tM4ESNkyQcCIfBUMYgEomjDKPZaBdNQroBVgZeME0CyifKzPwjIY8w4gCAFBLAwQUAAAACADsZWpdh13rKWcAAAB4AAAACgAAAFBvaW50cy50YWIty7EOgjAUBdD9fcUtE2xFcGIyiolLp4a9yiM0qYW01cS/JzbdzxHJPB2T+HKIdvPopCTxWk2InKD4k4JxRDderLfpD3T2gP7tDHXRj2nEtfiqhIqAu2U3R7QEAN68OSvUp3PfYKADUEsBAhQAFAAAAAgA7GVqXX7VpohNAAAAWQAAAAcAAAAAAAAAAAAAAAAAAAAAAE1hcC53b3JQSwECFAAUAAAACADsZWpdI4hnrigAAABBAQAACgAAAAAAAAAAAAAAAAByAAAAUG9pbnRzLmRhdFBLAQIUABQAAAAIAOxlal0Itzb5BgAAAAQAAAAJAAAAAAAAAAAAAAAAAMIAAABQb2ludHMuaWRQSwECFAAUAAAACADsZWpdxwIUs+sAAAAACgAACgAAAAAAAAAAAAAAAADvAAAAUG9pbnRzLm1hcFBLAQIUABQAAAAIAOxlal2HXespZwAAAHgAAAAKAAAAAAAAAAAAAAAAAAICAABQb2ludHMudGFiUEsFBgAAAAAFAAUAFAEAAJECAAAAAA==', 'base64');
const pkg = 'kz.solin.field.v23build';
const adb = (...args) => execFileSync('adb', args, {encoding:'utf8'}).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runInWebView(url) {
 const socket = new WebSocket(url);
 await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, {once:true});
  socket.addEventListener('error', reject, {once:true});
 });
 try {
  let id = 0;
  function evaluate(expression) {
   return new Promise((resolve, reject) => {
    const requestId = ++id;
    const timeout = setTimeout(() => {
     socket.removeEventListener('message', receive);
     reject(Error('Android WebView did not finish the import'));
    }, 120000);
    function receive(event) {
     const response = JSON.parse(event.data);
     if (response.id !== requestId) return;
     clearTimeout(timeout);
     socket.removeEventListener('message', receive);
     const error = response.error?.message || response.result?.exceptionDetails?.exception?.description;
     if (error) reject(Error(error));
     else resolve(response.result?.result?.value);
    }
    socket.addEventListener('message', receive);
    socket.send(JSON.stringify({id:requestId, method:'Runtime.evaluate',
     params:{expression, awaitPromise:true, returnByValue:true}}));
   });
  }
  for (let attempt = 0; attempt < 30; attempt++) {
   if (await evaluate("typeof window.openMapScreen === 'function'")) break;
   await delay(1000);
  }
  const bytes = JSON.stringify([...zip]);
  const result = await evaluate(`(async () => {
   window.openMapScreen();
   const input = document.querySelector('#mapFileInput');
   const file = new File([new Uint8Array(${bytes})], 'MapInfo fixture.zip', {type:'application/zip'});
   const transfer = new DataTransfer();
   transfer.items.add(file);
   input.files = transfer.files;
   input.dispatchEvent(new Event('change'));
   const accepted = await window.__solinMapImportPromise;
   const entry = importedMapLayers.find(layer => layer.name === 'Points');
   if (!entry) throw Error(document.querySelector('#mapImportStatus')?.textContent || 'MapInfo layer absent');
   const center = entry.layer.getBounds().getCenter();
   const index = importedMapLayers.indexOf(entry);
   toggleImportedLayer(index, false);
   const hidden = !fieldMap.hasLayer(entry.layer);
   toggleImportedLayer(index, true);
   return {accept:input.accept, count:entry.count, lat:center.lat, lng:center.lng,
    visible:fieldMap.hasLayer(entry.layer), hidden, accepted:accepted.size};
  })()`);
  assert.match(result.accept, /\.zip/);
  assert.equal(result.count, 1);
  assert.equal(result.accepted, 1);
  assert.ok(result.hidden && result.visible);
  assert.ok(Math.abs(result.lat - 50.338347098) < 0.000001);
  assert.ok(Math.abs(result.lng - 59.576610848) < 0.000001);
  console.log('Android WebView ZIP import, CRS and layer toggle passed:', result);
 } finally { socket.close(); }
}

async function main() {
 adb('install', '-r', 'android/app/build/outputs/apk/debug/app-debug.apk');
 adb('shell', 'am', 'start', '-n', pkg + '/kz.solin.field.MainActivity');
 let port;
 for (let attempt = 0; attempt < 30; attempt++) {
  const pid = adb('shell', 'pidof', pkg).split(/\s+/)[0];
  if (pid) {
   port ||= adb('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid);
   const pages = await fetch('http://127.0.0.1:' + port + '/json/list')
    .then(response => response.json()).catch(() => []);
   const page = pages.find(target => target.type === 'page' && target.url.startsWith('http'));
   if (page) return runInWebView(page.webSocketDebuggerUrl);
  }
  await delay(2000);
 }
 throw Error('Could not connect to Android WebView');
}
main().catch(error => {console.error(error);process.exitCode = 1;});
