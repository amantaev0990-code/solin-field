/* SOLI-N Field | Single-button, in-place MDB export.
 * A same-origin off-screen WASM frame generates the file. All user-facing
 * interaction remains inside Field; source cards never leave this device. */
(() => {
  'use strict';
  const BUTTON_ID = 'solin-mdb-export';
  const MIME = 'application/vnd.ms-access';
  const isAndroid = () => window.Capacitor?.isNativePlatform?.() &&
    window.Capacitor?.getPlatform?.() === 'android';
  const safeName = name => /^Transf_[1-9]\d*_[1-9]\d*_(19\d\d|20\d\d|21\d\d|2200)\.mdb$/.test(name);
  const identityName = id => 'Transf_' + id.POS + '_' + id.LESN + '_' + id.GodT + '.mdb';
  const jet = bytes => bytes.byteLength >= 2048 &&
    String.fromCharCode(...bytes.slice(4, 19)) === 'Standard Jet DB';

  function install() {
    document.getElementById('solin-mdb-wasm-test')?.remove();
    if (isAndroid()) return; // Keep existing native Android export.
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    let busy = false;
    let readyFile = null;
    let frame = null;
    let onMessage = null;
    let deadline = null;

    const render = (detail = 'Сохранить базу в формате MDB') => {
      button.type = 'button';
      button.disabled = busy;
      const small = document.createElement('small');
      small.textContent = detail;
      const title = document.createElement('b');
      title.textContent = 'Экспорт';
      const left = document.createElement('span');
      left.append(title, small);
      const right = document.createElement('span');
      right.textContent = '⇩';
      button.replaceChildren(left, right);
    };
    const message = error => {
      const text = error?.message || String(error || 'Не удалось создать MDB.');
      if (typeof toast === 'function') toast('Экспорт MDB: ' + text);
      else alert('Экспорт MDB: ' + text);
    };
    function clearReady() {
      if (readyFile?.url) URL.revokeObjectURL(readyFile.url);
      readyFile = null;
      if (!busy) render();
    }
    function download() {
      if (!readyFile) return;
      const link = document.createElement('a');
      link.href = readyFile.url;
      link.download = readyFile.name;
      link.style.display = 'none';
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
    }
    function cleanFrame() {
      if (deadline) clearTimeout(deadline);
      deadline = null;
      if (onMessage) window.removeEventListener('message', onMessage);
      onMessage = null;
      frame?.remove();
      frame = null;
    }
    function finish() {
      cleanFrame();
      busy = false;
      render(readyFile ? 'MDB готов · нажмите для повторного сохранения' :
        'Сохранить базу в формате MDB');
    }

    button.onclick = async () => {
      if (busy) return;
      if (readyFile) {
        download(); // A trusted iPhone tap if Safari blocked auto-download.
        return;
      }
      busy = true;
      render('Создаю MDB из выбранного лесничества…');
      try {
        const ws = window.SolinWorkspace;
        if (!ws?.ready || !ws?.persist) throw Error('Лесничество ещё не готово.');
        await ws.ready;
        if (!ws.activeId) throw Error('Откройте лесничество перед экспортом.');
        await ws.persist();
        const snapshot = window.SolinMDBBridge?.snapshot?.();
        if (snapshot?.format !== 'SOLIN-MDB-Bridge-v1')
          throw Error('Не удалось получить данные Transfer.');
        const identity = snapshot.identity;
        const expectedForest = String(identity.POS) + '::' + String(identity.LESN);
        if (expectedForest !== ws.activeId)
          throw Error('Адрес выбранного лесничества не совпадает с карточками.');
        if (Object.keys(snapshot.tables || {}).length !== 18)
          throw Error('Обнаружены дополнительные таблицы, не поддерживаемые текущим MDB. Выгрузка остановлена.');
        const filename = identityName(identity);
        if (!safeName(filename)) throw Error('Некорректное имя Transfer MDB.');

        const token = window.crypto?.randomUUID?.() ||
          Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        const url = new URL('mdb-wasm-poc/', document.baseURI);
        url.searchParams.set('export', '1');
        url.searchParams.set('forest', expectedForest);
        url.searchParams.set('embed', '1');
        url.searchParams.set('token', token);

        frame = document.createElement('iframe');
        frame.title = 'Внутренний модуль экспорта MDB';
        frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        // Do not use display:none: Safari can defer WebAssembly in hidden frames.
        frame.style.cssText = 'position:fixed!important;width:1px!important;height:1px!important;' +
          'left:-10000px!important;top:0!important;opacity:0!important;pointer-events:none!important;border:0!important;';

        onMessage = event => {
          if (!frame || event.source !== frame.contentWindow ||
              event.origin !== window.location.origin) return;
          const result = event.data;
          if (!result || result.token !== token) return;
          if (result.type === 'solin-mdb-error') {
            finish();
            message(new Error(String(result.error || 'Не удалось создать MDB.').slice(0, 400)));
            return;
          }
          if (result.type !== 'solin-mdb-ready') return;
          try {
            if (result.name !== filename || !safeName(result.name) ||
                !(result.bytes instanceof ArrayBuffer)) {
              throw Error('Получен неверный MDB или файл другого лесничества.');
            }
            const bytes = new Uint8Array(result.bytes);
            if (!jet(bytes) || bytes.byteLength > 100_000_000)
              throw Error('Созданный файл не прошёл проверку формата Jet MDB.');
            readyFile = {
              url: URL.createObjectURL(new Blob([bytes], {type: MIME})),
              name: filename,
              forest: expectedForest
            };
            finish();
            // This might be blocked on iOS after async computation. The same
            // Export button stays available for a subsequent trusted tap.
            download();
          } catch (error) {
            finish();
            message(error);
          }
        };
        window.addEventListener('message', onMessage);
        frame.addEventListener('error', () => {
          finish();
          message(new Error('Не удалось загрузить встроенный модуль MDB.'));
        }, {once:true});
        // Fail clearly rather than holding the only Export button indefinitely.
        deadline = setTimeout(() => {
          if (!busy) return;
          finish();
          message(new Error('Движок MDB не ответил. Проверьте интернет и повторите экспорт.'));
        }, 150000);
        frame.src = url.href;
        document.body.appendChild(frame);
      } catch(error) {
        finish();
        message(error);
      }
    };
    window.addEventListener('solin-saved', clearReady);
    window.addEventListener('solin-forest-changed', clearReady);
    window.addEventListener('pagehide', clearReady);
    render();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
