/* SOLI-N Field | Safe entry point to isolated on-device WebAssembly MDB test.
 * Keeps the existing Export button and working forestry cards unchanged. */
(() => {
  'use strict';
  const ID = 'solin-mdb-wasm-test';
  const escapeText = value => String(value ?? '').replace(/[&<>"']/g,
    char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function install() {
    const original = document.getElementById('solin-mdb-export');
    const menu = document.querySelector('#menuScreen .workspace');
    if (!menu || !original || document.getElementById(ID)) return;

    const button = document.createElement('button');
    button.id = ID;
    button.className = 'menuRow';
    button.type = 'button';
    button.innerHTML = '<span><b>Новый конвертер MDB (тест)</b>' +
      '<small>Без сервера · отдельная проверка WebAssembly</small></span><span>↗</span>';
    original.insertAdjacentElement('afterend', button);
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        const workspaces = window.SolinWorkspace;
        if (!workspaces?.ready || !workspaces?.persist || !workspaces.activeId) {
          throw Error('Сначала откройте рабочее лесничество.');
        }
        await workspaces.ready;
        // Flush unsaved edits before the test page reads the same-origin IndexedDB.
        await workspaces.persist();
        const data = window.SolinMDBBridge?.snapshot?.();
        const identity = data?.identity;
        if (!identity || String(identity.POS)+'::'+String(identity.LESN) !== workspaces.activeId) {
          throw Error('Адрес выбранного лесничества не совпал с рабочими данными.');
        }
        if (Object.keys(data.tables || {}).length !== 18) {
          throw Error('В базе есть дополнительные таблицы. Новый конвертер пока их не поддерживает; выгрузка отменена без потери данных.');
        }
        const name = 'Transf_' + identity.POS + '_' + identity.LESN + '_' + identity.GodT + '.mdb';
        if (typeof openModal !== 'function') throw Error('Окно подтверждения недоступно.');
        openModal('Проверка нового MDB-конвертера',
          '<p><b>' + escapeText(data.forest || 'Выбранное лесничество') + '</b></p>' +
          '<p>Тестовая выгрузка: <code>' + escapeText(name) + '</code>.</p>' +
          '<p>Это отдельный эксперимент. Файл будет помечен TEST_, пока его приём настольным SOLI-N не проверен. Рабочие карточки не изменяются.</p>' +
          '<div class="formActions"><button type="button" onclick="closeModal()">Отмена</button>' +
          '<button type="button" class="primary" id="solin-open-wasm-test">Открыть конвертер</button></div>');
        document.getElementById('solin-open-wasm-test')?.addEventListener('click', () => {
          window.location.assign(new URL('mdb-wasm-poc/', document.baseURI).href);
        });
      } catch (error) {
        if (typeof toast === 'function') toast(error.message || 'Не удалось открыть конвертер.');
        else alert(error.message || 'Не удалось открыть конвертер.');
      } finally {
        button.disabled = false;
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
