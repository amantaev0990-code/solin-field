/* Read-only datasheets for the bundled SOLI-N Access calculation references. */
(() => {
  'use strict';

  const CATALOG = Object.freeze([
    {code:'SSHB', title:'Шкалы высот, возраста и бонитета', purpose:'К58: определение класса бонитета по происхождению, возрасту и высоте'},
    {code:'Szap', title:'Таблицы нормативного запаса', purpose:'К59: запас древостоя по области, лесохозяйственной зоне, породе и высоте'},
    {code:'SzapCK', title:'Таблицы запаса молодых насаждений', purpose:'К59: отдельная ветвь расчёта для малой высоты и соответствующих условий'},
    {code:'SDP_Tip', title:'Группы пород для расчёта запаса', purpose:'Поля запроса Access, используемые при расчёте по К59'},
    {code:'SDP', title:'Коды древесных пород', purpose:'Связь породы в карточке с нормативными таблицами'},
    {code:'Slxr', title:'Лесохозяйственные зоны', purpose:'Проверка зоны выдела и соответствия региональным таблицам запаса'},
    {code:'SKU', title:'Категории угодий', purpose:'Определение применимости правил к выбранной категории'},
    {code:'SIAR', title:'Допустимые ярусы', purpose:'Зависимые ограничения ввода состава насаждений'},
    {code:'PIAP', title:'Нормативы по ярусам', purpose:'Контроль допустимых значений по коду яруса'}
  ]);
  // Physical field order from the Solim.mdb inventory. SDP_Tip is the
  // bundled projection of the Access query, in its original SELECT order.
  const ACCESS_COLUMNS = {
    SSHB: 'Происх Возр ВозрН ВозрК Н1б Н1а Н1 Н2 Н3 Н4 Н5 Н5а Н5б',
    Szap: `Obl LXZ KUL p1 ${Array.from({length:39}, (_, i) => 'v' + (i + 1)).join(' ')} Prior`,
    SzapCK: `Obl p1 Boni ${Array.from({length:34}, (_, i) => 'v' + String(i + 5).padStart(2, '0') + 'c').join(' ')} Priorc MH`,
    SDP_Tip: 'KPC ОбПор NDR',
    SDP: 'DKP2 KUCHL KPC KPCKZ NDP NDPKZ NDPK KPLP Происхож Продол ОбПор T47 ОбПорКЗ PLP KodXC Z1 Z2 Z3 Z4 Z5 Z6 Z7 Z8 Z10 Z11 Z13 Z14 Z15 Z16 Z17 Z18 Z19 Z20 Z21 Z25 Z26 Z27 Z28 V1_1 V1_2 V2_1 V2_2 V2_3 V2_4 V3_0 V4_1 V4_2 V5_1 V5_2 V5_3 V5_4',
    Slxr: 'Kpz Klxz Nlxr NlxrKZ PLRP SelOc SNKN SNKK SSKN SSKK SXKN PNKN PNKK PSKN PSKK PXKN Obx',
    SKU: 'KU KLF PN NKU NKUKZ NKU_1 NKU_1KZ P31 P10 PM KPOL PF1 Kpoj Land GrMak Pj1 Pj2 Pj3 Pj4 Pj5 Pj6 Pj7 Pj8 Pj10 Pj11 Pj13 Pj14 Pj15 Pj16 Pj17 Pj18 Pj19 Pj20 Pj21 Pj25 Pj26 Pj27 Pj28',
    SIAR: 'Ia KIAR NIAR',
    PIAP: 'KIAR AMZ Hn Hk Dк SKALn SKALk TURn TURk'
  };
  const COLUMN_LABELS = {
    SSHB:{Происх:'Код происхождения', Возр:'Возраст, лет', ВозрН:'Возраст от, лет', ВозрК:'Возраст до, лет'},
    Szap:{Obl:'Код области', LXZ:'Код лесохозяйственной зоны', p1:'Шифр породы'},
    SzapCK:{Obl:'Код области', p1:'Шифр породы', Boni:'Класс бонитета'},
    SDP:{KPC:'Шифр породы', NDP:'Название породы'},
    Slxr:{Klxz:'Код лесохозяйственной зоны', Nlxr:'Название зоны'},
    SKU:{KU:'Код категории угодий', NKU:'Название категории угодий'},
    SIAR:{KIAR:'Код яруса', NIAR:'Название яруса'}
  };
  const PAGE_SIZE = 60;

  let root, input, list, status;
  const searchText = value => String(value ?? '').trim().toLowerCase().replaceAll('ё', 'е');

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
      '<p>Данные SOLI-N из Microsoft Access · только просмотр</p></div></div>'+
      '<input id="calcRefsSearch" type="search" autocomplete="off" placeholder="Поиск таблицы, кода или значения…" aria-label="Поиск по расчётным справочникам">'+
      '<p id="calcRefsStatus" role="status" aria-live="polite"></p>'+
      '<div id="calcRefsList"></div></div>';
    input = root.querySelector('#calcRefsSearch');
    status = root.querySelector('#calcRefsStatus');
    list = root.querySelector('#calcRefsList');
    input.addEventListener('input', render);
    return root;
  }

  function showTable(host, item, columns, rows) {
    const scroll = document.createElement('div');
    scroll.className = 'calc-refs-scroll';
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', item.code + ' · просмотр таблицы');
    const table = document.createElement('table');
    table.className = 'calc-refs-table';
    table.setAttribute('aria-label', item.title + ' (' + item.code + ')');
    const header = table.createTHead().insertRow();
    for (const column of columns) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = column;
      const label = COLUMN_LABELS[item.code]?.[column];
      if (label) cell.title = label;
      header.append(cell);
    }
    const body = table.createTBody();
    scroll.append(table);
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'refMore';
    host.append(scroll, more);

    let shown = 0;
    function appendPage() {
      const stop = Math.min(shown + PAGE_SIZE, rows.length);
      const fragment = document.createDocumentFragment();
      for (; shown < stop; shown++) {
        const row = document.createElement('tr');
        for (const field of columns) {
          const value = rows[shown]?.[field];
          const cell = row.insertCell();
          if (value == null) {
            cell.className = 'calc-refs-null';
            cell.title = 'Пустое значение (NULL)';
            cell.textContent = '—';
          } else {
            if (typeof value === 'number') cell.className = 'calc-refs-number';
            cell.textContent = String(value);
          }
        }
        fragment.append(row);
      }
      body.append(fragment);
      more.hidden = shown === rows.length;
      more.textContent = 'Показано ' + shown + ' из ' + rows.length + ' · Ещё ' + Math.min(PAGE_SIZE, rows.length - shown);
    }
    more.addEventListener('click', appendPage);
    appendPage();
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
      const columns = ACCESS_COLUMNS[item.code].split(' ');
      const metadataMatches = searchText([item.code, item.title, item.purpose, ...columns].join(' ')).includes(query);
      const rows = query && !metadataMatches
        ? source.filter(row => columns.some(column => searchText(row?.[column]).includes(query)))
        : source;
      if (!rows.length) continue;
      count++;
      const details = document.createElement('details');
      details.className = 'refCard';
      details.dataset.table = item.code;
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
          showTable(rowsHost, item, columns, rows);
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

  // SolinWorkspace sees #calculationRefs.screen and routes to it.
  // Observe the actual screen switch: document capture listeners can run
  // BEFORE the workspace's click handler, so a queued render on click
  // alone can fire too early and leave the directory empty.
  new MutationObserver(() => {
    if (root.classList.contains('active')) render();
  }).observe(root, {attributes:true, attributeFilter:['class']});
  window.addEventListener('solin-refs-ready', () => {
    if (root.classList.contains('active')) render();
  });
})();
