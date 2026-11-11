const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');

// Synthetic one-point MapInfo workspace in UTM 40N with CP866 ZIP filenames.
const zip = Buffer.from('UEsDBBQAAAAIAMFral0PXIWOVwAAAFoAAAAHAAAATWFwLndvcvMvSM1TCElMyklVULqw4MLWC/svbL3YcLFbScGxWCEgPzOvpJjLN7FAwa0oPxfGD04tUfBNLOBSUPBJrEwtUjDkUlBQUHDJLC7ISaxUcC9KLMjITOYCAFBLAwQUAAAACADsZWpdI4hnrigAAABBAQAACgAAAJClr6Xg6y5kYXRjTubkZGRgYHBk+M+ADeQl5qZCmc4g4h+aPK9CWmZFSWkRTNFIA1IAUEsDBBQAAAAIAOxlal0Itzb5BgAAAAQAAAAJAAAAkKWvpeDrLmlkE2FhYAAAUEsDBBQAAAAIAOxlal3HAhSz6wAAAAAKAAAKAAAAkKWvpeDrLm1hcGPg4hPlE5NetGy1lJb+0pVbl2+9yS+uLCyvzS+u7B+ePGfJygUr1i5ZsVZMypJX0Hzpyq1LVqzdtO3O3r1ftPVDT5y5cfz0hcvX/x469JNhaIJN4e1MXxgZmCC8D/a8HsGMG5ycFWE0hgY2KM3BwMBI0HR2JmZGBg+QSkaGDAYGDhl2388uTjWBcQ4lcddrfRkjHeZzLn7y9mXPQaiGBgjp4wAzoWLOIuWdf97bg4Vb5Byp4edRMApggImBjwE9rTOBEjZMkHAiHwVDGIBKJowyj2WgXTUK6AVYGXjBNAsonysz8IyGPMOIAgBQSwMEFAAAAAgA7GVqXYdd6ylnAAAAeAAAAAoAAACQpa+l4OsudGFiLcuxDoIwFAXQ/X3FLRNsRXBiMoqJS6eGvcojNKmFtNXEvyc23c8RyTwdk/hyiHbz6KQk8VpNiJyg+JOCcUQ3Xqy36Q909oD+7Qx10Y9pxLX4qoSKgLtlN0e0BADevDkr1Kdz32CgA1BLAQIUABQAAAAIAMFral0PXIWOVwAAAFoAAAAHAAAAAAAAAAAAAAAAAAAAAABNYXAud29yUEsBAhQAFAAAAAgA7GVqXSOIZ64oAAAAQQEAAAoAAAAAAAAAAAAAAAAAfAAAAJClr6Xg6y5kYXRQSwECFAAUAAAACADsZWpdCLc2+QYAAAAEAAAACQAAAAAAAAAAAAAAAADMAAAAkKWvpeDrLmlkUEsBAhQAFAAAAAgA7GVqXccCFLPrAAAAAAoAAAoAAAAAAAAAAAAAAAAA+QAAAJClr6Xg6y5tYXBQSwECFAAUAAAACADsZWpdh13rKWcAAAB4AAAACgAAAAAAAAAAAAAAAAAMAgAAkKWvpeDrLnRhYlBLBQYAAAAABQAFABQBAACbAgAAAAA=', 'base64');
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
   await window.__solinMapImportPromise;
   if (importedMapLayers.length) throw Error('Maps opened automatically');
   const input = document.querySelector('#mapFileInput');
   const file = new File([new Uint8Array(${bytes})], 'MapInfo fixture.zip', {type:'application/zip'});
   const transfer = new DataTransfer();
   transfer.items.add(file);
   input.files = transfer.files;
   input.dispatchEvent(new Event('change'));
   const accepted = await window.__solinMapImportPromise;
   const entry = importedMapLayers.find(layer => layer.name === 'Реперы');
   if (!entry) throw Error(document.querySelector('#mapImportStatus')?.textContent || 'MapInfo layer absent');
   const center = entry.layer.getBounds().getCenter();
   const index = importedMapLayers.indexOf(entry);
   toggleImportedLayer(index, false);
   const hidden = !fieldMap.hasLayer(entry.layer);
   toggleImportedLayer(index, true);
   const values=document.querySelector('#mapLayerList input[aria-label="Значения"]');
   if(!values?.checked)throw Error('Values are missing from the shared layer list');
   values.click();
   const mark=[...document.querySelectorAll('.field-map-tools button')].find(button=>button.textContent==='Метка');
   if(!mark?.disabled)throw Error('Drawing remained enabled with Values hidden');
   values.click();
   const area=[...document.querySelectorAll('.field-map-tools button')].find(button=>button.textContent==='Площадь');
   area.click();
   const square=[[50.33,59.57],[50.33,59.58],[50.34,59.58]];
   for(const point of square)fieldMap.fire('click',{latlng:L.latLng(point)});
   const badge=document.querySelector('.field-map-area');
   if(badge.hidden||!badge.textContent.includes(' га')||document.querySelectorAll('.field-area-handle').length!==3)
    throw Error('Area or editable vertices absent');
   document.querySelector('.field-area-handle').click();
   if(document.querySelectorAll('.field-area-handle').length!==2)throw Error('Area vertex tap did not delete the vertex');
   [...document.querySelectorAll('.field-map-tools button')].find(button=>button.textContent==='Отмена').click();
   const result = {accept:input.accept, count:entry.count, lat:center.lat, lng:center.lng,
    visible:fieldMap.hasLayer(entry.layer), hidden, accepted:accepted.size};
   const action = label => [...document.querySelectorAll('#mapLibraryList button')]
    .find(button => button.textContent === label);
   action('Закрыть').click();
   await window.__solinMapImportPromise;
   if (importedMapLayers.length) throw Error('Closing the map left layers visible');
   action('Открыть').click();
   await window.__solinMapImportPromise;
   if (importedMapLayers.length !== 1) throw Error('Saved map did not reopen');
   window.confirm = () => true;
   action('Удалить').click();
   await window.__solinMapImportPromise;
   if (importedMapLayers.length || action('Удалить')) throw Error('Map was not removed from the library');
   if(document.querySelector('#mapLibraryList').textContent.includes('встроенная'))throw Error('A built-in map is still listed');
   return result;
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
 console.log(adb('shell', 'am', 'start', '-W', '-n', pkg + '/kz.solin.field.MainActivity'));
 let port, previousPid;
 for (let attempt = 0; attempt < 30; attempt++) {
  const pid = adb('shell', 'pidof ' + pkg + ' || true').split(/\s+/)[0];
  if (pid !== previousPid) { port = undefined; previousPid = pid; }
  if (pid) {
   port ||= adb('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid);
   const pages = await fetch('http://127.0.0.1:' + port + '/json/list')
    .then(response => response.json()).catch(() => []);
   const page = pages.find(target => target.type === 'page' && target.url.startsWith('http'));
   if (page) return runInWebView(page.webSocketDebuggerUrl);
  }
  await delay(2000);
 }
 console.error(adb('logcat', '-d', '-t', '200', 'AndroidRuntime:E', '*:S'));
 throw Error('Could not connect to Android WebView');
}
main().catch(error => {console.error(error);process.exitCode = 1;});
