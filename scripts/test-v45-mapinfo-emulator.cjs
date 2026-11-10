const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');

// Synthetic one-point MapInfo workspace in UTM 40N.
const zip = Buffer.from('UEsDBBQAAAAIAOxlal1+1aaITQAAAFkAAAAHAAAATWFwLndvcvMvSM1TCElMyklVUArIz8wrKVZScCxWgDB5uXwTCxTcivJz4QLBqSUKvokFvFwKCj6JlalFCoYgpoKCS2ZxQU5ipYJ7UWJBRmYyLxcAUEsDBBQAAAAIAOxlal0jiGeuKAAAAEEBAAAKAAAAUG9pbnRzLmRhdGNO5uRkZGBgcGT4z4AN5CXmpkKZziDiH5o8r0JaZkVJaRFM0UgDUgBQSwMEFAAAAAgA7GVqXQi3NvkGAAAABAAAAAkAAABQb2ludHMuaWQTYWFgAABQSwMEFAAAAAgA7GVqXccCFLPrAAAAAAoAAAoAAABQb2ludHMubWFwY+DiE+UTk160bLWUlv7SlVuXb73JL64sLK/NL67sH548Z8nKBSvWLlmxVkzKklfQfOnKrUtWrN207c7evV+09UNPnLlx/PSFy9f/Hjr0k2Fogk3h7UxfGBmYILwP9rwewYwbnJwVYTSGBjYozcHAwEjQdHYmZkYGD5BKRoYMBgYOGXbfzy5ONYFxDiVx12t9GSMd5nMufvL2Zc9BqIYGCOnjADOhYs4i5Z1/3tuDhVvkHKnh51EwCmCAiYGPAT2tM4ESNkyQcCIfBUMYgEomjDKPZaBdNQroBVgZeME0CyifKzPwjIY8w4gCAFBLAwQUAAAACADsZWpdh13rKWcAAAB4AAAACgAAAFBvaW50cy50YWIty7EOgjAUBdD9fcUtE2xFcGIyiolLp4a9yiM0qYW01cS/JzbdzxHJPB2T+HKIdvPopCTxWk2InKD4k4JxRDderLfpD3T2gP7tDHXRj2nEtfiqhIqAu2U3R7QEAN68OSvUp3PfYKADUEsBAhQAFAAAAAgA7GVqXX7VpohNAAAAWQAAAAcAAAAAAAAAAAAAAAAAAAAAAE1hcC53b3JQSwECFAAUAAAACADsZWpdI4hnrigAAABBAQAACgAAAAAAAAAAAAAAAAByAAAAUG9pbnRzLmRhdFBLAQIUABQAAAAIAOxlal0Itzb5BgAAAAQAAAAJAAAAAAAAAAAAAAAAAMIAAABQb2ludHMuaWRQSwECFAAUAAAACADsZWpdxwIUs+sAAAAACgAACgAAAAAAAAAAAAAAAADvAAAAUG9pbnRzLm1hcFBLAQIUABQAAAAIAOxlal2HXespZwAAAHgAAAAKAAAAAAAAAAAAAAAAAAICAABQb2ludHMudGFiUEsFBgAAAAAFAAUAFAEAAJECAAAAAA==', 'base64');
const pkg = 'kz.solin.field.v23build';
const adb = (...args) => execFileSync('adb', args, {encoding:'utf8'}).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
 adb('install', '-r', 'android/app/build/outputs/apk/debug/app-debug.apk');
 adb('shell', 'am', 'start', '-n', pkg + '/kz.solin.field.MainActivity');
 let port;
 for (let attempt = 0; attempt < 30; attempt++) {
  try {
   const pid = adb('shell', 'pidof', pkg).split(/\s+/)[0];
   if (pid) {
    port ||= adb('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid);
    const endpoint = 'http://127.0.0.1:' + port;
    if ((await fetch(endpoint + '/json/list').then(r => r.json())).length) {
     const browser = await chromium.connectOverCDP(endpoint);
     try {
      const page = browser.contexts()[0].pages()[0];
      await page.waitForFunction(() => typeof window.openMapScreen === 'function');
      await page.evaluate(() => window.openMapScreen());
      const input = page.locator('#mapFileInput');
      assert.match(await input.getAttribute('accept'), /\.zip/);
      await input.setInputFiles({name:'MapInfo fixture.zip', mimeType:'application/zip', buffer:zip});
      await page.waitForFunction(() => /открыт|Ошибка/.test(document.querySelector('#mapImportStatus')?.textContent || ''), null, {timeout:120000});
      const result = await page.evaluate(async () => {
       const accepted = await window.__solinMapImportPromise;
       const entry = importedMapLayers.find(layer => layer.name === 'Points');
       if (!entry) throw Error(document.querySelector('#mapImportStatus')?.textContent || 'MapInfo layer absent');
       const center = entry.layer.getBounds().getCenter();
       const index = importedMapLayers.indexOf(entry);
       toggleImportedLayer(index, false);
       const hidden = !fieldMap.hasLayer(entry.layer);
       toggleImportedLayer(index, true);
       return {count:entry.count, lat:center.lat, lng:center.lng,
        visible:fieldMap.hasLayer(entry.layer), hidden, accepted:accepted.size};
      });
      assert.equal(result.count, 1);
      assert.equal(result.accepted, 1);
      assert.ok(result.hidden && result.visible);
      assert.ok(Math.abs(result.lat - 50.338347098) < 0.000001);
      assert.ok(Math.abs(result.lng - 59.576610848) < 0.000001);
      console.log('Android WebView ZIP import, CRS, and layer toggle passed:', result);
     } finally { await browser.close(); }
     return;
    }
   }
  } catch (error) {
   if (error.name !== 'TypeError' && !error.status) throw error;
  }
  await delay(2000);
 }
 throw Error('Could not connect to Android WebView');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
