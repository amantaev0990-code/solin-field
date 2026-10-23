/* Read-only local SOLI-N Transfer reader. Access data is parsed in a worker;
 * Access forms, SQL, macros and VBA are never executed. */
(function (scope) {
  'use strict';
  const MAX_BYTES = 100 * 1024 * 1024;
  const MAX_ROWS = 500000;
  const REQUIRED = ['Лесничество', 'Квартал', 'Выдел'];
  const canonical = name => String(name).normalize('NFC').trim().toLocaleLowerCase('ru');
  const isWorker = typeof document === 'undefined';
  const scriptURL = isWorker ? scope.location.href : document.currentScript?.src;
  function fail(message) { throw new Error(message); }
  function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function normalizeTables(input) {
    if (!plain(input)) fail('В файле нет таблиц SOLI-N.');
    const result = {}, seen = new Set();
    let count = 0;
    for (const [rawName, rows] of Object.entries(input)) {
      const name = REQUIRED.find(n => canonical(n) === canonical(rawName)) || String(rawName).normalize('NFC').trim();
      if (['__proto__', 'constructor', 'prototype'].includes(name)) fail('Недопустимое имя таблицы.');
      if (seen.has(canonical(name))) fail('В файле повторяется таблица «' + name + '».');
      seen.add(canonical(name));
      if (!Array.isArray(rows)) fail('Таблица «' + name + '» должна содержать список записей.');
      count += rows.length;
      if (count > MAX_ROWS) fail('В файле больше 500 000 записей. Разделите Transfer по лесничествам.');
      for (const row of rows) {
        if (!plain(row)) fail('В таблице «' + name + '» обнаружена некорректная запись.');
        if (Object.keys(row).some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) fail('Недопустимое имя поля в таблице «' + name + '».');
      }
      result[name] = rows;
    }
    const missing = REQUIRED.filter(name => !Object.hasOwn(result, name));
    if (missing.length) fail('Это не Transfer лесничества: отсутствуют таблицы «' + missing.join('», «') + '».');
    if (!result['Лесничество'].length) fail('В файле не указано ни одного лесничества.');
    return result;
  }
  function backupTables(data) {
    if (!Array.isArray(data.lesnichestvo) || !plain(data.quarters)) fail('Резервная копия не содержит адрес лесничества и кварталы.');
    const tables = { ...(data.extraTables || {}), 'Лесничество': data.lesnichestvo, 'Квартал': [], 'Выдел': [] };
    for (const [kv, quarter] of Object.entries(data.quarters)) {
      if (!plain(quarter) || !Array.isArray(quarter.compartments)) fail('Некорректный квартал «' + kv + '» в резервной копии.');
      const rows = quarter.quarterRows?.length ? quarter.quarterRows : [{ ...quarter.meta, KV: quarter.meta?.KV ?? Number(kv) }];
      for (const row of rows) tables['Квартал'].push({ ...row });
      for (const stand of quarter.compartments) {
        const address = {};
        for (const key of ['POS', 'LESN', 'KV', 'KGLF', 'VD']) address[key] = stand[key] ?? quarter.meta?.[key] ?? data.lesnichestvo[0]?.[key] ?? (key === 'KV' ? Number(kv) : null);
        const base = {};
        for (const [key, value] of Object.entries(stand)) if (key !== '_children') base[key] = value;
        tables['Выдел'].push({ ...base, ...address });
        for (const [name, children] of Object.entries(stand._children || {})) {
          if (!/^Макет\d+$/i.test(name) || !Array.isArray(children)) fail('Некорректный раздел выдела «' + name + '».');
          (tables[name] ||= []).push(...children.map(row => ({ ...row, ...address })));
        }
      }
    }
    return tables;
  }
  function parseJSON(text) {
    let payload;
    try { payload = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (_) { fail('Файл JSON повреждён или сохранён не в UTF-8.'); }
    if (!plain(payload)) fail('Ожидается Transfer или резервная копия SOLI-N Field.');
    const tables = payload.format === 'SOLIN-Field-Backup-v2' ? backupTables(payload) : payload.tables;
    return { format: 'SOLI-N Transfer', schemaVersion: 2, sourceFormat: payload.format || 'JSON', tables: normalizeTables(tables) };
  }
  async function parseBytes(buffer, filename) {
    if (!buffer.byteLength || buffer.byteLength > MAX_BYTES) fail('Выберите непустой Transfer размером до 100 МБ.');
    const bytes = new Uint8Array(buffer);
    const signature = new TextDecoder('ascii').decode(bytes.subarray(0, 32));
    if (/Standard (Jet|ACE) DB/.test(signature)) {
      if (!scope.SolinMDB) {
        if (isWorker) importScripts(new URL('./vendor/mdb-reader.bundle.js', scriptURL).href);
        else fail('Модуль MDB не загружен. Откройте приложение в браузере с поддержкой фонового чтения файлов.');
      }
      let reader;
      try { reader = new scope.SolinMDB.Reader(scope.SolinMDB.Buffer.from(buffer)); }
      catch (_) { fail('Не удалось открыть MDB/ACCDB. Возможно, база повреждена, зашифрована или защищена паролем.'); }
      const tables = {}, names = reader.getTableNames({ normalTables: true, systemTables: false, linkedTables: false });
      let total = 0;
      for (const name of names) {
        const table = reader.getTable(name);
        total += table.rowCount;
        if (total > MAX_ROWS) fail('В базе больше 500 000 записей. Выберите Transfer одного лесничества.');
        try {
          tables[name] = table.getData().map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
            value instanceof Date ? value.toISOString() : typeof value === 'bigint' ? value.toString() : value
          ])));
        } catch (_) { fail('Не удалось прочитать таблицу «' + name + '». Сформируйте новый Transfer в SOLI-N.'); }
      }
      return { format: 'SOLI-N Transfer', schemaVersion: 2, sourceFormat: /Standard ACE DB/.test(signature) ? 'ACCDB' : 'MDB', tables: normalizeTables(tables) };
    }
    if (/\.(mdb|accdb)$/i.test(filename)) fail('Файл не содержит корректной базы Access MDB/ACCDB.');
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (_) { fail('Файл JSON сохранён не в UTF-8 или имеет неизвестный формат.'); }
    return parseJSON(text);
  }
  if (isWorker) {
    scope.onmessage = async event => {
      try { scope.postMessage({ ok: true, payload: await parseBytes(event.data.buffer, event.data.name) }); }
      catch (error) { scope.postMessage({ ok: false, error: error.message || 'Не удалось прочитать Transfer.' }); }
    };
    return;
  }
  scope.SolinTransferReader = {
    maxBytes: MAX_BYTES,
    async read(file) {
      if (!file || typeof file.arrayBuffer !== 'function') fail('Выберите файл Transfer.');
      if (!file.size || file.size > MAX_BYTES) fail('Выберите непустой Transfer размером до 100 МБ.');
      const buffer = await file.arrayBuffer();
      if (typeof Worker === 'undefined') return parseBytes(buffer, file.name || '');
      return new Promise((resolve, reject) => {
        let worker;
        try { worker = new Worker(scriptURL); } catch (_) { reject(new Error('Браузер запретил фоновое чтение Transfer.')); return; }
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('Чтение заняло больше минуты. Выберите Transfer меньшего размера.')); }, 60000);
        const done = () => { clearTimeout(timer); worker.terminate(); };
        worker.onmessage = event => { done(); event.data.ok ? resolve(event.data.payload) : reject(new Error(event.data.error)); };
        worker.onerror = () => { done(); reject(new Error('Модуль чтения Transfer недоступен. Подключитесь к сети и откройте приложение заново.')); };
        worker.postMessage({ buffer, name: file.name || '' }, [buffer]);
      });
    }
  };
})(globalThis);
