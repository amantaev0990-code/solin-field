/* V66: a dedicated, read-only screen for calculation reference tables.
 * The general SOLI-N directory (refsScreen) is deliberately unchanged.
 * All data are read from the SAME original bundled SOLIN_REFS, never fabricated.
 */
(() => {
  'use strict';

  const CATALOG = Object.freeze([
    {code:'SSHB', title:'Шкалы высот, возраста и бонитета', purpose:'К58: определение класса бонитета по происхождению, возрасту и высоте'},
    {code:'Szap', title:'Таблицы нормативного запаса', purpose:'К59: запас древостоя по области, лесохозяйственной зоне, породе и высоте'},
    {code:'SzapCK', title:'Таблицы запаса молодых насаждений', purpose:'К59: отдельная ветвь расчёта для малой высоты и соответствующих условий'},
    {code:'SDP_Tip', title:'Группы пород для расчёта запаса', purpose:'К59: группа NDR и выбор нормативной ветви'},
    {code:'SDP', title:'Коды древесных пород', purpose:'Связь породы в карточке с нормативными таблицами'},
    {code:'Slxr', title:'Лесохозяйственные зоны', purpose:'Проверка зоны выдела и соответствия региональным таблицам запаса'},
    {code:'SKU', title:'Категории угодий', purpose:'Определение применимости правил к выбранной категории'},
    {code:'SIAR', title:'Допустимые ярусы', purpose:'Зависимые ограничения ввода состава насаждений'},
    {code:'PIAP', title:'Связи категорий угодий и ярусов', purpose:'Проверка допустимых ярусов по исходным зависимостям'}
  ]);

  let root, input, list, status;
  const clean = value => String(value ?? '').trim();
  const searchText = value => clean(value).toLocaleLowerCase('ru-RU');
  const entries = row => Object.entries(row || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');

  function ensure() {
    if (root && root.isConnected) return root;
    const existing = document.getElementById('calculationRefs');
    if (existing) {
      root = existing;
    } else {
      root = document.createElement('section');
      root.id = 'calculationRefs';
      root.className = 'screen';
      // Keep the new screen alongside the other app screens, not in a modal.
      const other = document.getElementById('refsScreen');
      if (other) other.insertAdjacentElement('afterend', root);
      else document.querySelector('.app')?.append(root);
    }
    root.innerHTML = '<div class="workspace">'+
      '<div class="screenHead"><div><h2>Справочники для расчётов</h2>'+
      '<p>Нормативные таблицы из SOLI-N · только просмотр</p></div></div>'+
      '<input id="calcRefsSearch" type="search" autocomplete="off" placeholder="Поиск таблицы, кода или значения…" aria-label="Поиск по расчётным справочникам">'+
      '<p id="calcRefsStatus" role="status" aria-live="polite"></p>'+
      '<div id="calcRefsList"></div></div>';
    input = root.querySelector('#calcRefsSearch');
    status = root.querySelector('#calcRefsStatus');
    list = root.querySelector('#calcRefsList');
    input.addEventListener('input', render);
    return root;
  }

  function appendRows(host, rows, start, code) {
    const limit = Math.min(start + 60, rows.length);
    const fragment = document.createDocumentFragment();
    for (let i = start; i < limit; i++) {
      const item = document.createElement('div');
      item.className = 'wf-check';
      // Values are text nodes, never interpreted as HTML.
      for (const [key, value] of entries(rows[i])) {
        const span = document.createElement('span');
        const label = document.createElement('span');
        label.textContent = key + ': ';
        const strong = document.createElement('b');
        strong.textContent = clean(value);
        span.append(label, strong);
        span.style.marginRight = '8px';
        item.append(span);
      }
      fragment.append(item);
    }
    host.append(fragment);
    if (limit < rows.length) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'refMore';
      more.textContent = 'Ещё 60 из ' + rows.length;
      more.addEventListener('click', event => {
        event.preventDefault();
        more.remove();
        appendRows(host, rows, limit, code);
      });
      host.append(more);
    }
  }

  function render() {
    ensure();
    const tables = window.SOLIN_REFS?.tables;
    list.replaceChildren();
    if (!tables) {
      status.textContent = 'Ожидание загрузки исходных справочников SOLI-N…';
      return;
    }
    const query = searchText(input.value);
    let count = 0;
    for (const item of CATALOG) {
      const source = tables[item.code];
      if (!Array.isArray(source) || source.length === 0) continue;
      const metadataMatches = searchText(item.code + ' ' + item.title + ' ' + item.purpose).includes(query);
      const rows = query && !metadataMatches
        ? source.filter(row => entries(row).some(([key, val]) => searchText(key + ' ' + val).includes(query)))
        : source;
      if (!rows.length) continue;
      count++;
      const details = document.createElement('details');
      details.className = 'refCard';
      const summary = document.createElement('summary');
      const heading = document.createElement('b');
      heading.textContent = item.title + ' (' + item.code + ')';
      const size = document.createElement('small');
      size.textContent = ' · ' + rows.length + ' строк';
      summary.append(heading, size);
      const purpose = document.createElement('p');
      purpose.className = 'wf-muted';
      purpose.textContent = item.purpose;
      const rowsHost = document.createElement('div');
      details.append(summary, purpose, rowsHost);
      let populated = false;
      details.addEventListener('toggle', () => {
        if (details.open && !populated) {
          populated = true;
          appendRows(rowsHost, rows, 0, item.code);
        }
      });
      list.append(details);
    }
    status.textContent = count
      ? 'Расчётных таблиц: ' + count + '. Откройте нужную таблицу для просмотра строк.'
      : (query ? 'Совпадений не найдено.' : 'Расчётные таблицы отсутствуют в загруженном комплекте. Обычные справочники доступны отдельно.');
  }

  ensure();
  window.SolinCalculationRefs = Object.freeze({ensure, render, tableCodes:CATALOG.map(item => item.code)});

  // Capture before SolinWorkspace's main-menu handler. That handler sees
  // #calculationRefs.screen and calls show('calculationRefs') instead of
  // falling back to show('refsScreen'). Render only after that navigation.
  document.addEventListener('click', event => {
    if (event.target.closest?.('button[data-field-route="calculationRefs"]'))
      queueMicrotask(() => { if (root.classList.contains('active')) render(); });
  }, true);
  window.addEventListener('solin-refs-ready', () => {
    if (root.classList.contains('active')) render();
  });
})();