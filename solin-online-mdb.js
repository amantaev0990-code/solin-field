/* SOLI-N Field — authenticated online MDB export (no misleading ZIP/MDB renaming).
 * Endpoint address persists locally. Bearer token remains ONLY in this tab's memory. */
(function () {
  'use strict';
  const KEY = 'solin_private_mdb_endpoint_v1';
  let endpoint = '';
  let token = '';
  try { endpoint = localStorage.getItem(KEY) || ''; } catch (_) {}
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  const show = (title, html) => {
    if (typeof openModal === 'function') openModal(title, html);
    else throw new Error('Экран экспорта недоступен.');
  };
  const button = () => document.getElementById('solin-mdb-export');
  const buttonBusy = busy => { const b = button(); if (b) b.disabled = busy; };
  function normalizeURL(raw) {
    const url = new URL(String(raw).trim());
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Введите адрес HTTPS сервера без параметров и пароля.');
    }
    const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) throw new Error('Сервер MDB должен использовать HTTPS.');
    const pathname = url.pathname.replace(/\/+$/, '');
    if (pathname && pathname !== '/api/export') throw new Error('Адрес должен заканчиваться на /api/export.');
    url.pathname = '/api/export';
    return url.href;
  }
  function config() {
    show('Подключение экспорта MDB',
      '<p>Для создания настоящего <b>MDB</b> нужен защищённый сервер SOLI-N с оригинальным Transfer. ' +
      'Это не публичный сервис: адрес и ключ выдаются при развёртывании.</p>' +
      '<label style="display:block;margin:10px 0">Адрес сервера HTTPS<input type="url" id="solin-mdb-endpoint" ' +
      'placeholder="https://ваш-сервер.example/api/export" value="' + esc(endpoint) + '" ' +
      'style="width:100%;box-sizing:border-box"></label>' +
      '<label style="display:block;margin:10px 0">Ключ доступа<input type="password" id="solin-mdb-token" ' +
      'placeholder="Секретный ключ сервера" autocomplete="off" style="width:100%;box-sizing:border-box"></label>' +
      '<p><small>Ключ не сохраняется на телефоне. Его потребуется ввести заново при повторном открытии приложения.</small></p>' +
      '<p role="alert" id="solin-mdb-config-error"></p>' +
      '<div class="formActions"><button type="button" onclick="closeModal()">Отмена</button>' +
      '<button type="button" id="solin-mdb-connect" class="primary">Подключить и экспортировать</button></div>');
    const connect = document.getElementById('solin-mdb-connect');
    if (connect) connect.onclick = () => {
      try {
        const nextEndpoint = normalizeURL(document.getElementById('solin-mdb-endpoint').value);
        const nextToken = document.getElementById('solin-mdb-token').value;
        if (nextToken.length < 32) throw new Error('Ключ доступа должен быть не короче 32 символов.');
        endpoint = nextEndpoint; token = nextToken;
        try { localStorage.setItem(KEY, endpoint); } catch (_) {}
        exportMDB();
      } catch (error) { document.getElementById('solin-mdb-config-error').textContent = error.message; }
    };
  }
  async function exportMDB() {
    if (!endpoint || !token) return config();
    buttonBusy(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    let binaryURL = '';
    try {
      if (!navigator.onLine) throw new Error('Для экспорта MDB нужен интернет. Карточки остаются сохранёнными офлайн.');
      await window.SolinWorkspace?.ready;
      await window.SolinWorkspace?.persist?.();
      const snapshot = window.SolinMDBBridge?.snapshot?.();
      if (!snapshot || snapshot.format !== 'SOLIN-MDB-Bridge-v1') throw new Error('Не удалось сформировать Transfer.');
      show('Создание MDB','<p role="status">Отправляю данные защищённому конвертеру и проверяю MDB…</p><p>Не закрывайте страницу до завершения передачи.</p>');
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-store',
        redirect: 'error',
        credentials: 'omit',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
        signal: controller.signal
      });
      if (!response.ok) {
        let detail = '';
        try { detail = (await response.json()).error || ''; } catch (_) {}
        if (response.status === 401) {
          token = '';
          throw new Error('Неверный ключ сервера. Повторно подключите экспорт.');
        }
        throw new Error(detail || ('Сервер не выполнил экспорт (HTTP ' + response.status + ').'));
      }
      const raw = await response.arrayBuffer();
      if (!raw.byteLength || raw.byteLength > 100 * 1024 * 1024) throw new Error('Размер полученного MDB недопустим.');
      const header = new TextDecoder('latin1').decode(new Uint8Array(raw, 0, Math.min(raw.byteLength, 32)));
      if (!header.includes('Standard Jet DB')) throw new Error('Сервер прислал файл без корректной подписи MDB. Сохранение отменено.');
      const { POS, LESN, GodT } = snapshot.identity;
      const filename = 'Transf_' + POS + '_' + LESN + '_' + GodT + '_Field.mdb';
      const blob = new Blob([raw], { type: 'application/vnd.ms-access' });
      binaryURL = URL.createObjectURL(blob);
      show('MDB сформирован',
        '<p><b>' + esc(filename) + '</b></p>' +
        '<p>Сервер сформировал файл Access на основе оригинального Transfer. ' +
        'Проверка приёма в настольном SOLI-N ещё обязательна.</p>' +
        '<div id="solin-final-mdb-link"></div>' +
        '<p><small>На iPhone нажмите «Сохранить MDB». При необходимости выберите «Поделиться» → «Сохранить в Файлы».</small></p>' +
        '<div class="formActions"><button type="button" id="solin-mdb-settings">Сменить сервер</button>' +
        '<button type="button" onclick="closeModal()">Закрыть</button></div>');
      const holder = document.getElementById('solin-final-mdb-link');
      if (!holder) throw new Error('Не удалось показать ссылку для сохранения.');
      const anchor = document.createElement('a');
      anchor.href = binaryURL;
      anchor.download = filename;
      anchor.textContent = 'Сохранить MDB';
      anchor.className = 'primary';
      anchor.style.cssText = 'display:flex;justify-content:center;align-items:center;min-height:48px;border-radius:12px;background:#238b4b;color:white;font-weight:700;text-decoration:none;margin:10px 0;padding:8px';
      holder.append(anchor);
      document.getElementById('solin-mdb-settings').onclick = config;
      // Download links remain alive while the user chooses "Save to Files".
      setTimeout(() => URL.revokeObjectURL(binaryURL), 10 * 60 * 1000);
    } catch (error) {
      const msg = error?.name === 'AbortError' ? 'Время ожидания сервера истекло. Повторите экспорт.' :
        error instanceof TypeError ? 'Нет связи с сервером, либо сервер ещё не развёрнут или не разрешил соединение.' :
        error.message;
      show('MDB не создан',
        '<p role="alert">' + esc(msg) + '</p>' +
        '<p>Данные лесничества на телефоне не изменены.</p>' +
        '<div class="formActions"><button type="button" id="solin-mdb-reconfigure">Настроить сервер</button>' +
        '<button type="button" onclick="closeModal()">Закрыть</button></div>');
      document.getElementById('solin-mdb-reconfigure').onclick = config;
    } finally {
      clearTimeout(timeout);
      buttonBusy(false);
    }
  }
  function install() {
    const b = button();
    if (!b) return;
    b.type = 'button';
    b.innerHTML = '<span><b>Экспорт</b><small>Сохранить настоящий MDB через защищённый сервер</small></span><span>⇩</span>';
    b.onclick = exportMDB;
  }
  window.SolinOnlineMDB = { exportMDB, configure: config, get configured() { return Boolean(endpoint && token); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
