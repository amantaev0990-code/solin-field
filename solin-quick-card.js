(() => {
  'use strict';
  const order = ['base','10','31','32','23','2','4'];
  const label = n => n === 'base' ? 'Поля выдела' : 'Макет ' + n;
  const button = (text, action, className) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = text;
    element.className = className || '';
    element.addEventListener('click', action);
    return element;
  };

  function mount(form, editor) {
    form.classList.add('quick-card-form');
    const main = form.querySelector('#ce-main');
    const base = document.createElement('section');
    base.id = 'quick-card-base';
    const number = main.querySelector('.dt-base > :first-child');
    const baseFields = ['KU','M3Pr','M3TLU','PLV'].map(key =>
      main.querySelector('[data-ce-scope="base"][data-ce-field="' + key + '"]').closest('.dt-cell'));
    base.append(number, ...baseFields);
    main.prepend(base);

    const nav = document.createElement('nav');
    nav.className = 'quick-card-nav';
    nav.setAttribute('aria-label','Быстрый ввод');
    let step = 'base';
    let lastField;
    const fields = () => [...form.querySelectorAll('input[data-ce-field], select[data-ce-field], textarea[data-ce-field]')]
      .filter(el => el.getClientRects().length && !el.readOnly && !el.disabled && !el.closest('[hidden], [inert]'));
    const focus = el => {
      if (!el) return;
      el.focus({preventScroll:true});
      el.scrollIntoView({block:'nearest',inline:'nearest'});
    };
    const tabs = order.map(n => button(label(n), () => go(n)));
    function go(n) {
      step = n;
      lastField = null;
      form.dataset.quickStep = n;
      tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(order[i] === n)));
      if (n === '23') editor.showExtra('Макет23');
      else editor.showMain();
      focus(fields()[0]);
    }
    function next(el) {
      const controls = fields();
      const index = controls.indexOf(el);
      if (index < 0 && controls.length) return focus(controls[0]);
      const successor = index >= 0 ? controls[index + 1] : undefined;
      if (successor) {
        // Maket 10 can rebuild a row on change. Resolve the next cell again.
        const {ceField,ceRow,ceScope} = successor.dataset;
        el.blur();
        return focus(fields().find(item => item.dataset.ceField === ceField &&
          item.dataset.ceRow === ceRow && item.dataset.ceScope === ceScope));
      }
      const following = order[order.indexOf(step) + 1];
      if (following) go(following);
      else form.querySelector('#ce-save').focus();
    }
    form.addEventListener('focusin', event => {
      if (fields().includes(event.target)) lastField = event.target;
    });
    form.addEventListener('keydown', event => {
      if (!form.dataset.quickStep || event.key !== 'Enter' || event.isComposing || !fields().includes(event.target)) return;
      if (form.querySelector('#ce-assist:not([hidden]), #v35-forest-group-dialog')) return;
      event.preventDefault();
      event.stopPropagation();
      next(event.target);
    });
    const enter = button('Ввод ↵', () => next(lastField), 'quick-card-enter');
    enter.addEventListener('pointerdown', event => event.preventDefault());
    nav.append(...tabs, button('Все макеты', () => {
      delete form.dataset.quickStep;
      editor.showMaketNavigator();
    }), enter);
    form.querySelector('.dt-toolbar').after(nav);
    go('base');
  }

  const escape = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const value = (name, val) => '<label><span>' + name + '</span><output>' + escape(val) + '</output></label>';
  const cells = (record, columns) => columns.map(([name,key]) => value(name,record[key])).join('');
  const block = (id, record, columns) => '<div class="kt-block"><b>' + id + '</b>' + cells(record,columns) + '</div>';
  const stand = [['Ярус','IAR'],['Коэф.','KOEF'],['Порода','POR'],['А, лет','LET'],['Н, м','PH'],['Д, см','PD2'],['Класс товар.','KT'],['Происхожд.','PROI'],['Полнота','POL'],['Пл. сеч.','SPS'],['Запас, м³/га','ZAP']];
  function standValue(row, key) {
    const raw = row[key];
    if (key !== 'POL' || raw == null || String(raw).trim() === '') return raw;
    const number = Number(String(raw).replace(',', '.'));
    const tenth = Math.round(number * 10) / 10;
    // Access Single imports can carry the binary approximation of a tenth.
    // Keep actual extra precision and whole-number survival percentages.
    if (tenth >= 0.1 && tenth <= 1 && Math.abs(number - tenth) < 1e-7) {
      return typeof raw === 'number' && Number.isInteger(raw) ? raw : String(tenth);
    }
    return raw;
  }

  function preview(record, forest) {
    const groups = Object.entries(record._children || {}).filter(([key,rows]) =>
      /^Макет\d+$/.test(key) && key !== 'Макет10' && rows.length);
    const rows = (record._children?.Макет10 || []).map(row =>
      '<tr>' + stand.map(([,key]) => '<td>' + escape(standValue(row, key)) + '</td>').join('') + '</tr>').join('');
    const additional = groups.flatMap(([key, entries]) => entries.map(row => {
      const columns = (D.transfSchema[key] || Object.keys(row)).filter(field =>
        !['POS','LESN','KV','KGLF','VD'].includes(field));
      return '<div class="kt-extra-row"><b>' + key.slice(5) + '</b>' +
        Array.from({length:Math.max(8, columns.length)}, (_, i) => '<output>' + escape(row[columns[i]]) + '</output>').join('') + '</div>';
    })).join('');
    return '<article class="kt-sheet"><header>' + value('Квартал',record.KV) +
      value('Лесничество',forest?.NOS) + '<h2>Карточка таксации</h2></header><div class="kt-grid">' +
      block(1, record, [['№ выд','VD'],['Площадь','PLV'],['Категория угодий','KU'],['Способ рубки','CR'],['ОЗУ','OZU'],['Склон эксп.','CkEk'],['Крутизна','CkKr'],['ВНУМ','VNUM'],['Эрозия вид','ErV'],['Степень','ErCt']]) +
      block(2, record, [['1-ое','M2PM1'],['% выб.','M2Pr'],['2-ое','M22'],['3-е','M23'],['Целевая порода','M2Cp']]) +
      block(3, record, [['Порода','M3Pr'],['Бонитет','M3B'],['Тип леса','M3TLU'],['Год вырубки','M3G'],['Пней всего','M3KP'],['Сосны','M3KPC'],['Диам. пней','M3D'],['Тип вырубки','M3TR']]) +
      block(4, record, [['Захламл. общая','M4ZO'],['Ликвид','M4ZL'],['Сухостой','M4SS'],['Текстовая запись','TXT']]) +
      '</div><div class="kt-stand"><table><thead><tr>' + stand.map(([name]) => '<th scope="col">' + name + '</th>').join('') +
      '</tr></thead><tbody>' + rows + '</tbody></table></div><div class="kt-grid">' +
      block(31, record, [['к-во т.шт.','PRkol'],['Н, м','PRH'],['А, лет','PRA'],['Коэф.','PRK1'],['Порода','PRP1'],['Коэф.','PRK2'],['Порода','PRP2'],['Коэф.','PRK3'],['Порода','PRP3'],['Оценка','PROC']]) +
      block(32, record, [['Густота','PLG'],['Порода','PLP1'],['Порода','PLP2'],['Порода','PLP3']]) +
      '</div><section class="kt-extras"><h3>Макеты дополнительных сведений</h3><div class="kt-extra-columns">' +
      '<div class="kt-extra-row"><b>№</b>' + Array.from({length:8}, (_, i) => '<span>' + (i + 1) + '</span>').join('') +
      '</div><div class="kt-extra-row"><b>№</b>' + Array.from({length:8}, (_, i) => '<span>' + (i + 1) + '</span>').join('') +
      '</div>' + additional + '</div></section><footer><button type="button" id="kt-exit">Выход</button></footer></article>';
  }

  function refresh() {
    const card = document.getElementById('card');
    const edit = card.querySelector('#wfEditBase');
    const tabs = card.querySelector('#childTabs');
    const details = card.querySelector('#humanContent');
    const footer = card.querySelector('#solin-v37-new-stand');
    if (!edit || !footer || !current) return;
    edit.textContent = 'Изменить карточку';
    details.replaceChildren(edit);
    card.querySelector('#childContent').replaceChildren();
    tabs.replaceChildren(button('Быстрый ввод', () => {
      const saved = D.quarters?.[String(current.KV)]?.compartments?.includes(current);
      window.SolinCardEditor.open(current, {isNew:!saved, quick:true});
    }, 'wf-primary'));
    if (!footer.querySelector('.kt-button')) footer.append(button('КТ', () => {
      const forest = D.lesnichestvo?.find(item => String(item.POS) === String(current.POS) && String(item.LESN) === String(current.LESN));
      openModal('ВыделКрат', preview(current,forest), {confirmChanges:false});
      document.getElementById('kt-exit').onclick = () => closeModal();
    }, 'v37-new-stand-button kt-button'));
  }

  window.SolinQuickCard = {mount};
  function init() {
    const render = window.renderComp;
    window.renderComp = function(...args) {
      const result = render.apply(this,args);
      queueMicrotask(refresh);
      return result;
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
