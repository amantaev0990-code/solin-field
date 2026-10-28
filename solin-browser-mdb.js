/* SOLI-N Field | Direct Safari MDB export experiment
   Runs Java/Jackcess inside the browser using CheerpJ. No server receives forest data.
   This is evaluation software. Exact Access column types must be validated against original SOLI-N.
   Android APK continues using the local native SolinMdb Capacitor plugin. */
(() => {
  'use strict';
  if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === 'android') return;
  const URL_JAR = './vendor/solin-browser-mdb-v20261028-27.jar';
  const URL_TEMPLATE = './vendor/solin-empty-transfer-v20261028-27.mdb';
  // CheerpJ /app mounts the *domain root*, not GitHub Pages project path.
  // The PWA lives under /solin-field/, so use the page-relative absolute URL.
  const CHEERPJ_JAR = '/app' + new URL(URL_JAR, document.baseURI).pathname;
  const URL_JAVA = 'https://cjrtnc.leaningtech.com/4.3/loader.js';
  let runtimePromise = null;
  let running = false;
  let downloadUrl = null;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button = () => document.getElementById('solin-mdb-export');
  const message = (title, html) => {
    if (typeof openModal !== 'function') throw Error('Недоступно окно экспорта');
    openModal(title, html);
  };
  const nameOf = id => 'Transf_' + id.POS + '_' + id.LESN + '_' + id.GodT + '.mdb';
  const jetHeader = buffer => {
    const arr = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 32));
    return arr.length >= 32 && String.fromCharCode(...arr.slice(4,19)) === 'Standard Jet DB';
  };
  function loadScript(src) {
    return new Promise((resolve,reject) => {
      const element = document.createElement('script');
      element.src = src;
      element.async = true;
      element.onload = resolve;
      element.onerror = () => reject(Error('Не удалось загрузить локальный движок Java. Проверьте подключение к интернету.'));
      document.head.appendChild(element);
    });
  }
  async function ensureRuntime() {
    if (!runtimePromise) {
      runtimePromise = (async () => {
        const response = await fetch(URL_JAR, { cache: 'no-store' });
        if (!response.ok) throw Error('Новая версия движка MDB ещё не загружена на сайт. Попробуйте обновить страницу.');
        const jar = await response.arrayBuffer();
        if (jar.byteLength < 100000 || new Uint8Array(jar)[0] !== 80 || new Uint8Array(jar)[1] !== 75) {
          throw Error('Модуль записи MDB повреждён или не является Java-архивом.');
        }
        if (typeof window.cheerpjInit !== 'function') await loadScript(URL_JAVA);
        if (typeof window.cheerpjInit !== 'function') throw Error('Java-движок не загрузился.');
        await window.cheerpjInit({ version: 17 });
        if (typeof window.cheerpOSAddStringFile !== 'function' ||
            typeof window.cheerpjRunMain !== 'function' ||
            typeof window.cjFileBlob !== 'function') {
          throw Error('Загруженный движок Java не поддерживает операции с файлами.');
        }
      })().catch(e => { runtimePromise = null; throw e; });
    }
    return runtimePromise;
  }
  const snapshot = async () => {
    await window.SolinWorkspace?.ready;
    await window.SolinWorkspace?.persist?.();
    const transfer = window.SolinMDBBridge?.snapshot?.();
    if (!transfer || transfer.format !== 'SOLIN-MDB-Bridge-v1') throw Error('Данные Transfer пока не готовы.');
    return transfer;
  };
  // A schema-only Jet MDB is built on the CI server and bundled as an app
  // asset. It contains 18 user tables and ZERO forestry records. The browser
  // fills a copy with the currently selected workspace, with NO upload dialog.
  let templatePromise = null;
  async function getAutomaticTemplate() {
    if (!templatePromise) templatePromise = (async () => {
      const response = await fetch(URL_TEMPLATE, {cache:'no-store'});
      if (!response.ok) throw Error('Пустой MDB-шаблон ещё не опубликован. Попробуйте обновить страницу позже.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 1024 || bytes.length > 12000000 ||
          !jetHeader(bytes.slice(0,32).buffer)) {
        throw Error('Встроенный MDB-шаблон повреждён. Экспорт остановлен.');
      }
      return bytes;
    })().catch(error=>{templatePromise=null;throw error;});
    return templatePromise;
  }
  async function verifyJavaReceipt(blob, output, transfer) {
    let receipt;
    try {
      receipt = JSON.parse(await (await window.cjFileBlob(output + '.verified.json')).text());
    } catch (_) { throw Error('Не получена Java-проверка созданного MDB. Выгрузка остановлена.'); }
    const id=transfer.identity;
    if (receipt?.format!=='SOLIN-JET-RECEIPT-v1' ||
        receipt.filename!==nameOf(id) || receipt.size!==blob.size ||
        Number(receipt.pos)!==Number(id.POS) ||
        Number(receipt.lesn)!==Number(id.LESN) ||
        Number(receipt.year)!==Number(id.GodT)) {
      throw Error('Новый MDB не совпадает с проверкой Java. Возможно, браузер открыл старый файл.');
    }
    for(const [name, rows] of Object.entries(transfer.tables)) {
      if(receipt.counts?.[name]!==rows.length)
        throw Error('Java-проверка MDB: неверное количество записей «' + name + '».');
    }
    if(!window.crypto?.subtle?.digest)
      throw Error('Браузер не поддерживает SHA-256 для проверки файла MDB.');
    const digest = new Uint8Array(await window.crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));
    const hex = [...digest].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(hex!==receipt.sha256)
      throw Error('Данные MDB отличаются от проверенной Java-копии. Скачивание остановлено.');
    return receipt;
  }
  function matchesCell(wanted, found) {
    if (wanted == null || wanted === '') return found == null || found === '';
    if (typeof wanted === 'boolean') return String(wanted) === String(found) ||
      Number(wanted) === Number(found);
    // The mobile card editor may serialize numeric Access values as "1,0"
    // or "1.0". Jackcess writes the exact numeric value, so readback must
    // compare it as a number, not as a literal formatting string.
    const numeric = v => {
      if (typeof v === 'number') return v;
      if (typeof v !== 'string') return Number.NaN;
      const t = v.trim();
      if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(t)) return Number.NaN;
      return Number(t.replace(',', '.'));
    };
    const a = numeric(wanted), b = numeric(found);
    // Access floating point values may round at database field precision.
    if (typeof wanted === 'number' || typeof found === 'number') {
      return Number.isFinite(a) && Number.isFinite(b) &&
        Math.abs(a - b) <= Math.max(0.000001,Math.abs(a)*0.000001);
    }
    if (wanted instanceof Date || found instanceof Date) {
      const t1 = new Date(wanted).getTime(), t2 = new Date(found).getTime();
      return Number.isFinite(t1) && t1 === t2;
    }
    return String(wanted).trim() === String(found).trim();
  }
  async function confirmOutput(blob, transfer) {
    const file = new File([blob], nameOf(transfer.identity), {type: 'application/vnd.ms-access'});
    if (!window.SolinTransferReader?.read) throw Error('Модуль проверки Access MDB не загружен.');
    const received = await window.SolinTransferReader.read(file);
    const expected = transfer.tables;
    const actual = received?.tables;
    if (!actual || typeof actual !== 'object') throw Error('MDB не содержит таблиц Transfer.');
    let checked = 0;
    for (const [name, rows] of Object.entries(expected)) {
      const candidate = actual[name];
      if (!Array.isArray(candidate) || candidate.length !== rows.length) {
        throw Error('Проверка MDB: число записей таблицы «' + name + '» не совпало.');
      }
      // Match all rows, including repeatable child makets, independent of row ordering.
      // Match every present source value, not just quarter/stand identifiers.
      const used = new Set();
      for (const originalRow of rows) {
        let match = -1;
        for (let i = 0; i < candidate.length; i++) {
          if (used.has(i)) continue;
          const actualRow = candidate[i];
          if (Object.entries(originalRow).every(([field, value]) =>
            field === '_children' || matchesCell(value, actualRow[field]))) {
            match = i;
            break;
          }
        }
        if (match < 0) {
          const location = ['POS','LESN','KV','KGLF','VD'].filter(k=>originalRow[k]!=null)
            .map(k=>k+'='+originalRow[k]).join(', ');
          throw Error('Проверка MDB: данные строки не совпадают в «' + name +
            '» (' + (location||'нет адреса') + ').');
        }
        used.add(match);
        checked++;
      }
    }
    if (checked < 1) throw Error('В готовом MDB нет записей для проверки.');
    return file;
  }
  async function exportBrowser() {
    if (running) return;
    running = true;
    const b = button();
    if (b) b.disabled = true;
    try {
      const transfer = await snapshot();
      message('Создание MDB',
        '<p>Формирую файл Access из текущих карточек выбранного лесничества. ' +
        'Загружать исходный MDB не нужно.</p>');
      const template = await getAutomaticTemplate();
      await ensureRuntime();
      // Every run gets a new path inside CheerpJ's persistent filesystem.
      // Reusing the same MDB path can expose stale file metadata to Safari.
      const directory = '/files/export-' + Date.now().toString(36) + '-' +
        Math.random().toString(36).slice(2,10);
      const output = directory + '/' + nameOf(transfer.identity);
      window.cheerpOSAddStringFile('/str/solin-original-transfer.mdb', template);
      // CheerpJ's UTF-8 decoder may pad Cyrillic Java strings with NUL chars.
      // Deliver ASCII JSON using \uXXXX escapes so Russian Access table names survive.
      const ascii = JSON.stringify(transfer).replace(/[^\x00-\x7F]/g, c =>
        '\\u' + c.charCodeAt(0).toString(16).padStart(4,'0'));
      window.cheerpOSAddStringFile('/str/solin-transfer.json', new TextEncoder().encode(ascii));
      const exit = await window.cheerpjRunMain(
        'kz.solin.mdb.BrowserMdbWriter',
        CHEERPJ_JAR,
        '/str/solin-original-transfer.mdb',
        '/str/solin-transfer.json',
        output
      );
      if (exit !== 0) {
        let reason = 'Не удалось записать MDB. Исходный файл и карточки не изменены.';
        try {
          // On iPhone there is no developer console: show the first Java error
          // from the local virtual filesystem instead of a useless generic text.
          const log = await (await window.cjFileBlob('/files/solin-browser-debug.txt')).text();
          const cause = log.split(/\r?\n/).find(line =>
            /(?:IllegalArgumentException|IOException|IllegalStateException|AccessException):/.test(line));
          if (cause) reason = 'Ошибка MDB: ' + cause.replace(/^\s*at\s+/, '').slice(0,500);
        } catch (_) { /* No diagnostic file available */ }
        throw Error(reason);
      }
      const blob = await window.cjFileBlob(output);
      if (!blob || blob.size < 1024 || !jetHeader(await blob.slice(0,32).arrayBuffer())) {
        throw Error('Файл не является настоящей базой Jet MDB.');
      }
      // Cross-check actual downloaded bytes against Java's second readback.
      // This is independent from the Javascript MDB viewer, which in Safari
      // sometimes reports "no forestry" for a Java-verified Jet file.
      await verifyJavaReceipt(blob, output, transfer);
      let file;
      let browserReadWarning = false;
      try {
        file = await confirmOutput(blob, transfer);
      } catch(error) {
        if (!/В файле не указано ни одного лесничества/.test(String(error?.message))) throw error;
        browserReadWarning = true;
        file = new File([blob], nameOf(transfer.identity), {type:'application/vnd.ms-access'});
      }
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(file);
      message('MDB готов к сохранению',
        '<p><b>' + esc(file.name) + '</b></p>' +
        (browserReadWarning
          ? '<p role="alert"><b>Тестовый MDB:</b> Java проверила таблицы и файл, ' +
            'а просмотрщик Safari не распознал строку лесничества. Файл можно сохранить ' +
            'для проверки в настольном SOLI-N только на резервной базе. Совместимость пока не подтверждена.</p>'
          : '<p>Создан настоящий Access MDB; данные повторно прочитаны. ' +
            'Сохраните файл в «Файлы» или передайте на компьютер.</p>') +
        '<div id="solin-direct-mdb-save"></div>' +
        '<button type="button" onclick="closeModal()">Закрыть</button>');
      const host = document.getElementById('solin-direct-mdb-save');
      if (!host) throw Error('Не удалось показать ссылку для сохранения.');
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.name;
      a.textContent = 'Сохранить MDB';
      a.className = 'primary';
      a.style.cssText = 'display:flex;align-items:center;justify-content:center;min-height:52px;margin:12px 0;padding:9px 16px;background:#238b4b;border-radius:12px;color:white;text-decoration:none;font-weight:700';
      host.appendChild(a);
      // Safari may suppress a programmatic download after asynchronous Java processing.
      // Keep the real link visible so a subsequent user tap always works.
      try { a.click(); } catch (_) {}
    } catch (e) {
      console.error('SOLIN local Safari MDB error:', e);
      message('Не удалось создать MDB',
        '<p role="alert">' + esc(e.message || 'Ошибка создания MDB') + '</p>' +
        '<p>Вместо MDB не будет выдан JSON или ZIP. Исходная база и карточки сохранены.</p>' +
        '<button type="button" onclick="closeModal()">Закрыть</button>');
    } finally {
      running = false;
      if (b) b.disabled = false;
    }
  }
  function install() {
    const b = button();
    if (!b) return;
    b.type = 'button';
    b.innerHTML = '<span><b>Экспорт</b><small>Выгрузить файл MDB</small></span><span>⇩</span>';
    b.onclick = exportBrowser;
  }
  window.SolinBrowserMDB = { exportBrowser, ensureRuntime };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();