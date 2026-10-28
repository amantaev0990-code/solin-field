/* SOLI-N Field | Local Safari MDB writer experiment
   Runs Java/Jackcess inside the browser using CheerpJ. No server receives forest data.
   This is evaluation software and is NOT an offline/commercial-use guarantee.
   Android APK continues using the local native SolinMdb Capacitor plugin. */
(() => {
  'use strict';
  if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === 'android') return;
  const URL_JAR = './vendor/solin-browser-mdb.jar';
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
  const nameOf = id => 'Transf_' + id.POS + '_' + id.LESN + '_' + id.GodT + '_Field.mdb';
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
        if (!response.ok) throw Error('Компонент записи MDB ещё не опубликован. Проверьте сборку приложения.');
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
  async function confirmOutput(blob, transfer) {
    const file = new File([blob], nameOf(transfer.identity), {type: 'application/vnd.ms-access'});
    if (!window.SolinTransferReader?.read) throw Error('Модуль проверки Access MDB не загружен.');
    const received = await window.SolinTransferReader.read(file);
    const original = transfer.tables;
    for (const name of Object.keys(original)) {
      const rows = received.tables?.[name];
      if (!Array.isArray(rows) || rows.length !== original[name].length) {
        throw Error('Проверка MDB: число записей таблицы «' + name + '» не совпало.');
      }
    }
    return file;
  }
  async function exportBrowser() {
    if (running) return;
    running = true;
    const b = button();
    if (b) b.disabled = true;
    try {
      const transfer = await snapshot();
      const local = await window.SolinOfflineMDB?.readStored?.(
        [transfer.identity.POS, transfer.identity.LESN, transfer.identity.GodT].join('::')
      );
      if (!local) { chooseOriginal(transfer); return; }
      if (!local.bytes || !jetHeader(local.bytes)) {
        chooseOriginal(transfer, 'Старый шаблон повреждён. Выберите исходный MDB заново.');
        return;
      }
      message('Создание MDB', '<p>Формирую файл Access на телефоне и проверяю таблицы. Исходный MDB не изменяется.</p>');
      await ensureRuntime();
      const output = '/files/' + nameOf(transfer.identity);
      window.cheerpOSAddStringFile('/str/solin-original.mdb', new Uint8Array(local.bytes));
      window.cheerpOSAddStringFile('/str/solin-transfer.json', new TextEncoder().encode(JSON.stringify(transfer)));
      const exit = await window.cheerpjRunMain(
        'kz.solin.mdb.BrowserMdbWriter',
        '/app/vendor/solin-browser-mdb.jar',
        '/str/solin-original.mdb',
        '/str/solin-transfer.json',
        output
      );
      if (exit !== 0) throw Error('Движок MDB не смог записать базу. Подробности в журнале браузера.');
      const blob = await window.cjFileBlob(output);
      if (!blob || blob.size < 1024 || !jetHeader(await blob.slice(0,32).arrayBuffer())) {
        throw Error('Файл не является настоящей базой Jet MDB.');
      }
      const file = await confirmOutput(blob, transfer);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(file);
      message('MDB готов к сохранению',
        '<p><b>' + esc(file.name) + '</b></p>' +
        '<p>Файл создан и повторно прочитан как Access MDB. Сохраните его в «Файлы», ' +
        'на флешку или отправьте на компьютер.</p>' +
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
  function chooseOriginal(transfer, error = '') {
    const originalName = 'Transf_' + transfer.identity.POS + '_' + transfer.identity.LESN + '_' + transfer.identity.GodT + '.mdb';
    message('Первое сохранение MDB',
      '<p>Один раз выберите исходный <b>' + esc(originalName) + '</b> из «Файлов» iPhone. ' +
      'В дальнейшем достаточно будет нажать «Экспорт». Файл останется в памяти телефона.</p>' +
      (error ? '<p role="alert">' + esc(error) + '</p>' : '') +
      '<input type="file" id="solin-browser-template" accept=".mdb,application/vnd.ms-access" style="width:100%">' +
      '<p id="solin-browser-template-error" role="alert"></p>' +
      '<button type="button" onclick="closeModal()">Отмена</button>');
    const chooser = document.getElementById('solin-browser-template');
    if (!chooser) return;
    chooser.onchange = async () => {
      try {
        const file = chooser.files?.[0];
        if (!file) return;
        if (file.size < 1024 || file.size > 12 * 1024 * 1024) throw Error('Неверный размер шаблона.');
        const buf = await file.arrayBuffer();
        if (!jetHeader(buf)) throw Error('Выбранный файл не настоящий MDB.');
        // Ensure matching forest and year before making the original the active template.
        const parsed = await window.SolinTransferReader.read(file);
        const first = parsed.tables?.['Лесничество']?.[0];
        if (!first || Number(first.POS) !== transfer.identity.POS ||
            Number(first.LESN) !== transfer.identity.LESN ||
            Number(first.GodT) !== transfer.identity.GodT) {
          throw Error('MDB относится к другому лесничеству или году.');
        }
        const key = [transfer.identity.POS, transfer.identity.LESN, transfer.identity.GodT].join('::');
        await window.SolinOfflineMDB.saveStored(key, { name: file.name, bytes: buf });
        await exportBrowser();
      } catch (err) {
        const node = document.getElementById('solin-browser-template-error');
        if (node) node.textContent = err.message;
        else message('MDB не выбран','<p>' + esc(err.message) + '</p>');
      }
    };
  }
  function install() {
    const b = button();
    if (!b) return;
    b.type = 'button';
    b.innerHTML = '<span><b>Экспорт</b><small>Сохранить настоящий MDB на телефоне</small></span><span>⇩</span>';
    b.onclick = exportBrowser;
  }
  window.SolinBrowserMDB = { exportBrowser, ensureRuntime };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();