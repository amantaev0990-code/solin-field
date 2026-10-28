/* SOLI-N Field — OFFLINE export package for creating a real Access MDB on Windows.
 * The browser cannot write Jet MDB. This module never fakes an MDB by renaming JSON. */
(function () {
  'use strict';
  const FILENAME = 'Build-SOLIN-Transfer-MDB.ps1';
  const KEYS = ['POS', 'LESN', 'KV', 'KGLF', 'VD'];
  const PRIMARY = ['Лесничество', 'Квартал', 'Выдел'];
  const clone = x => JSON.parse(JSON.stringify(x));
  const safeNumber = (value, label) => {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Неверный ' + label + '. Проверьте адрес лесничества.');
    return n;
  };
  function snapshot() {
    if (typeof D === 'undefined' || !D?.transfSchema || !D?.quarters) throw new Error('Сначала откройте лесничество.');
    const owner = D.lesnichestvo?.[0];
    if (!owner) throw new Error('Не выбрано лесничество.');
    const identity = {
      POS: safeNumber(owner.POS, 'номер лесовладельца'),
      LESN: safeNumber(owner.LESN, 'номер лесничества'),
      GodT: safeNumber(owner.GodT, 'год таксации')
    };
    const schema = clone(D.transfSchema);
    for (const name of PRIMARY) if (!Array.isArray(schema[name])) throw new Error('Нет исходной схемы «' + name + '».');
    const tables = Object.fromEntries(Object.keys(schema).map(name => [name, []]));
    const make = (name, row) => Object.fromEntries(schema[name].map(field => [field, row?.[field] ?? null]));
    tables['Лесничество'] = (D.lesnichestvo || []).map(row => make('Лесничество', row));
    for (const [kv, quarter] of Object.entries(D.quarters)) {
      const rows = quarter.quarterRows?.length ? quarter.quarterRows : [quarter.meta || {}];
      for (const qr of rows) {
        tables['Квартал'].push(make('Квартал', { ...owner, ...quarter.meta, ...qr, KV: Number(kv) }));
      }
      for (const r of quarter.compartments || []) {
        const address = Object.fromEntries(KEYS.map(k => [k, r[k] ?? quarter.meta?.[k] ?? owner[k] ?? null]));
        address.KV = Number(kv);
        if (address.POS != identity.POS || address.LESN != identity.LESN) throw new Error('В квартале ' + kv + ' обнаружен адрес другого лесничества.');
        if (!Number.isFinite(Number(r.PLV)) || Number(r.PLV) <= 0) throw new Error('У выдела ' + kv + '/' + r.VD + ' некорректная площадь.');
        tables['Выдел'].push(make('Выдел', { ...r, ...address }));
        for (const [name, children] of Object.entries(r._children || {})) {
          if (!Array.isArray(schema[name])) throw new Error('Нет схемы для «' + name + '». Экспорт остановлен, чтобы не потерять данные.');
          if (!Array.isArray(children)) throw new Error('Некорректный раздел карточки «' + name + '».');
          for (const row of children) tables[name].push(make(name, { ...row, ...address }));
        }
      }
    }
    // Include source tables imported as full Transfer, beyond the card editor's 18 mapped tables.
    for (const [name, rows] of Object.entries(D._transferExtras || {})) {
      if (Object.hasOwn(tables, name)) continue;
      if (!Array.isArray(rows)) throw new Error('Повреждена дополнительная таблица «' + name + '».');
      if (!rows.length) continue;
      if (!/^[\p{L}\p{N}_\-]+$/u.test(name)) throw new Error('Недопустимое имя таблицы «' + name + '».');
      const values = clone(rows);
      if (values.some(x => !x || typeof x !== 'object' || Array.isArray(x))) throw new Error('Некорректные строки «' + name + '».');
      schema[name] = [...new Set(values.flatMap(row => Object.keys(row)))];
      tables[name] = values;
    }
    const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
    return {
      format: 'SOLIN-MDB-Bridge-v1',
      createdAt: new Date().toISOString(),
      identity,
      forest: owner.NOS || '',
      owner: owner.NLX || '',
      source: D.source || {},
      instructions: 'This is a JSON transfer INSIDE a ZIP archive, not an MDB. Run the included Windows DAO builder against the matching original Transfer MDB.',
      schema, tables, counts
    };
  }
  function instructions(payload) {
    const { POS, LESN, GodT } = payload.identity;
    const total = Object.values(payload.counts).reduce((n, v) => n + v, 0);
    return [
      'SOLI-N Field — передача данных в настоящий MDB на Windows',
      '========================================================',
      'Лесничество: ' + payload.forest,
      'Адрес: POS=' + POS + ', LESN=' + LESN + ', год=' + GodT,
      'Таблиц в пакете: ' + Object.keys(payload.tables).length + '; строк: ' + total,
      '',
      'ВНИМАНИЕ: файл Transfer.json НЕ является MDB.',
      'Для создания настоящего MDB нужен Windows и оригинальный MDB-шаблон того же лесничества.',
      '',
      '1. Перенесите ZIP с телефона на компьютер и РАСПАКУЙТЕ все файлы в отдельную папку.',
      '2. Оставьте оригинальный файл C:\\Soli\\Transfer\\Transf_' + POS + '_' + LESN + '_' + GodT + '.mdb',
      '   либо C:\\Soli\\Transfer\\Transf.mdb на компьютере без изменений.',
      '3. Откройте PowerShell в папке распакованного ZIP и запустите:',
      '   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\\' + FILENAME + '"',
      '4. При отсутствии автоматически найденного файла укажите шаблон вручную:',
      '   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\\' + FILENAME + '" -TemplateMDB "D:\\Path\\Transf.mdb"',
      '5. Появится Transf_' + POS + '_' + LESN + '_' + GodT + '.mdb.',
      '6. Откройте готовый файл в Microsoft Access, проверьте таблицы и данные.',
      '   Затем используйте штатный прием Transfer в SOLI-N, сперва на резервной копии.',
      '',
      'Исходный MDB никогда не перезаписывается.',
      'Обновляются только таблицы, представленные в пакете. Прочие таблицы исходного MDB сохраняются',
      'из шаблона без изменений — их соответствие измененным выделам пока не проверено.',
      'Точное выполнение обмена в настольном SOLI-N пока НЕ прошло проверку.',
      'Если нет Access/Access Database Engine либо схема MDB не совпадает, скрипт останавливается.',
      'Работайте с копией базы: это обмен данными, а не автоматическая синхронизация.',
      ''
    ].join('\r\n');
  }
  // Mobile Safari needs a real tap on an anchor after asynchronous ZIP generation.
  // Do not report that a file was saved before the user actually taps the link.
  function offerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const host = document.getElementById('solin-download-area');
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.textContent = 'Сохранить ZIP для MDB';
    a.className = 'primary';
    a.style.cssText = 'display:flex;align-items:center;justify-content:center;text-align:center;min-height:48px;border-radius:12px;padding:10px 16px;text-decoration:none;box-sizing:border-box;background:#218546;color:white;font-weight:700;';
    if (!host) {
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      host.replaceChildren(a);
      const note = document.createElement('p');
      note.textContent = 'На iPhone после открытия файла выберите «Поделиться» → «Сохранить в Файлы», если браузер не скачает его автоматически.';
      host.append(note);
    }
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
  }
  async function exportForWindows() {
    const button = document.getElementById('solin-mdb-export');
    if (button) button.disabled = true;
    try {
      await window.SolinWorkspace?.ready;
      await window.SolinWorkspace?.persist?.();
      if (typeof JSZip === 'undefined') throw new Error('Модуль ZIP не загружен.');
      const payload = snapshot();
      const response = await fetch('./windows/' + FILENAME, { cache: 'force-cache' });
      if (!response.ok) throw new Error('Не удалось загрузить Windows-конвертер. Откройте приложение с интернетом один раз.');
      const builder = await response.text();
      if (!builder.includes('SOLIN-MDB-Bridge-v1')) throw new Error('Некорректная версия Windows-конвертера.');
      const zip = new JSZip();
      zip.file('Transfer.json', JSON.stringify(payload, null, 2));
      zip.file(FILENAME, builder);
      zip.file('README.txt', instructions(payload));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const { POS, LESN, GodT } = payload.identity;
      const filename = 'SOLIN-MDB-' + POS + '-' + LESN + '-' + GodT + '.zip';
      const detail = Object.values(payload.counts).reduce((n, c) => n + c, 0);
      if (typeof openModal === 'function') {
        openModal('Пакет для MDB готов',
          '<p><b>' + filename + '</b></p>' +
          '<p>Подготовлено ' + Object.keys(payload.tables).length + ' таблиц и ' + detail + ' строк.</p>' +
          '<p><b>Это ZIP, а не готовый MDB.</b> На Windows распакуйте архив и следуйте README.txt; для создания MDB потребуется исходная база Transfer.</p>' +
          '<div id="solin-download-area"></div>' +
          '<button type="button" onclick="closeModal()">Закрыть</button>');
      }
      offerDownload(blob, filename);
    } catch (err) {
      if (typeof toast === 'function') toast('MDB-пакет: ' + err.message);
      else alert(err.message);
      console.error('MDB-bridge export failed:', err);
    } finally {
      if (button) button.disabled = false;
    }
  }
  // Keep the «Ещё» page uncluttered: exactly one top-level export button.
  function addButton() {
    const host = document.querySelector('#menuScreen .workspace');
    if (!host) return;
    let button = document.getElementById('solin-mdb-export');
    if (!button) {
      button = document.createElement('button');
      button.id = 'solin-mdb-export'; button.className = 'menuRow'; button.type = 'button';
      host.querySelector('h2')?.after(button);
    }
    button.innerHTML = '<span><b>Экспорт</b><small>Передача данных в настольный SOLI-N</small></span><span>⇩</span>';
    // Remove stale menu entries from older cached versions without deleting their underlying data.
    for (const other of host.querySelectorAll(':scope > .menuRow')) {
      if (other === button) continue;
      if (/экспорт|скачать локальные данные JSON/i.test(other.textContent)) other.remove();
    }
    button.onclick = () => {
      let payload;
      try { payload = snapshot(); }
      catch (error) { if (typeof toast === 'function') toast(error.message); else alert(error.message); return; }
      const n = Object.values(payload.counts).reduce((sum, count) => sum + count, 0);
      if (typeof openModal !== 'function') { exportForWindows(); return; }
      openModal('Экспорт данных',
        '<p><b>' + String(payload.forest).replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</b></p>' +
        '<p>Подготовлено ' + Object.keys(payload.tables).length + ' таблиц и ' + n + ' записей.</p>' +
        '<p><b>Важно:</b> в веб-версии пока невозможно создать настоящий MDB непосредственно на телефоне. ' +
        'Сейчас доступен ZIP-пакет для последующего преобразования в MDB на Windows с оригинальным Transfer.</p>' +
        '<div class="formActions"><button type="button" onclick="closeModal()">Отмена</button>' +
        '<button type="button" id="solin-export-confirm" class="primary">Скачать пакет для MDB</button></div>');
      document.querySelector('#solin-export-confirm')?.addEventListener('click', exportForWindows);
    };
  }
  window.SolinMDBBridge = { snapshot, exportForWindows, instructions };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton);
  else addButton();
})();
