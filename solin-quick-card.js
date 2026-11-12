(() => {
  'use strict';
  const order = ['base','1','10','31','32','23','2','4'];
  const label = n => n === 'base' ? 'Поля выдела' : 'Макет ' + n;
  const button = (text, action, className) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = text;
    element.className = className || '';
    element.addEventListener('click', action);
    return element;
  };

  let releaseImeListeners = null;
  function mount(form, editor) {
    form.classList.add('quick-card-form');
    // Android may paint the keyboard over a fixed WebView dialog without
    // resizing its CSS viewport. Constrain the card to the *visual* viewport.
    releaseImeListeners?.();
    const modal = form.closest('#modal');
    const vv = window.visualViewport;
    let alignFrame = 0;
    const isInput = node => !!node && form.contains(node) &&
      node.matches?.('input:not([readonly]):not([disabled]),textarea:not([readonly]):not([disabled])');
    const keepInputVisible = () => {
      const active = document.activeElement;
      if (!isInput(active)) return;
      const scroller = active.closest('.ce-table-wrap') || form.querySelector('.dt-viewport');
      if (!scroller) return;
      const fieldRect = active.getBoundingClientRect(), area = scroller.getBoundingClientRect();
      if (fieldRect.bottom > area.bottom - 14) scroller.scrollTop += fieldRect.bottom - area.bottom + 24;
      else if (fieldRect.top < area.top + 10) scroller.scrollTop -= area.top - fieldRect.top + 18;
    };
    const alignIme = () => {
      if (!modal?.isConnected || !form.isConnected) return;
      const active = document.activeElement;
      const editing = isInput(active);
      modal.classList.toggle('ce-ime-visible', editing);
      if (editing) {
        const height = Math.max(180, Math.floor((vv?.height || window.innerHeight) - 10));
        modal.style.setProperty('--ce-ime-height', height + 'px');
        modal.style.setProperty('--ce-ime-top', Math.max(0, Math.floor(vv?.offsetTop || 0)) + 'px');
        cancelAnimationFrame(alignFrame);
        alignFrame = requestAnimationFrame(keepInputVisible);
      } else {
        modal.style.removeProperty('--ce-ime-height');
        modal.style.removeProperty('--ce-ime-top');
      }
    };
    // Do not move the modal during pointerdown/focusin. Otherwise Chromium
    // may finish a tap in a different position and reset its text caret.
    const onFocus = () => {setTimeout(alignIme, 90);setTimeout(alignIme, 230);};
    const onViewport = () => {alignIme();setTimeout(alignIme, 80);};
    form.addEventListener('focusin', onFocus);
    form.addEventListener('focusout', onFocus);
    window.addEventListener('resize', onViewport);
    vv?.addEventListener('resize', onViewport);
    vv?.addEventListener('scroll', onViewport);
    releaseImeListeners = () => {
      cancelAnimationFrame(alignFrame);
      form.removeEventListener('focusin', onFocus);
      form.removeEventListener('focusout', onFocus);
      window.removeEventListener('resize', onViewport);
      vv?.removeEventListener('resize', onViewport);
      vv?.removeEventListener('scroll', onViewport);
      modal?.classList.remove('ce-ime-visible');
      modal?.style.removeProperty('--ce-ime-height');
      modal?.style.removeProperty('--ce-ime-top');
    };
    const main = form.querySelector('#ce-main');
    const base = document.createElement('section');
    base.id = 'quick-card-base';
    const number = main.querySelector('.dt-base > :first-child');
    const baseFields = ['KU','M3Pr','M3TLU','PLV'].map(key =>
      main.querySelector('[data-ce-scope="base"][data-ce-field="' + key + '"]').closest('.dt-cell'));
    baseFields[2].classList.add('quick-card-forest-type');
    base.append(number, ...baseFields);
    main.prepend(base);

    const nav = document.createElement('nav');
    nav.className = 'quick-card-nav';
    nav.setAttribute('aria-label','Быстрый ввод');
    let step = 'base';
    let lastField;
    const fields = () => [...form.querySelectorAll('input[data-ce-field], select[data-ce-field]:not(.solin-species-native), textarea[data-ce-field], input[data-species-for]')]
      .filter(el => el.getClientRects().length && !el.readOnly && !el.disabled && !el.closest('[hidden], [inert]'));
    function caretToEnd(el) {
      if (!el?.matches('input:not([readonly]),textarea')) return;
      if (el.type==='number') {
        const value=el.value;
        el.type='text';
        el.inputMode=el.inputMode||'decimal';
        el.value=value;
      }
      if (el.selectionStart!==null) el.setSelectionRange(el.value.length,el.value.length);
    }
    const focus = el => {
      if (!el) return;
      if(el.tagName==='INPUT'&&!el.readOnly)el.enterKeyHint='next';
      el.focus({preventScroll:true});
      caretToEnd(el);
      el.scrollIntoView({block:'nearest',inline:'nearest'});
    };
    const tabs = order.map(n => button(label(n), () => go(n)));
    function go(n, focusFirst = false) {
      // Tapping a Maket tab must never summon or retain the numeric keyboard.
      if (form.contains(document.activeElement) && document.activeElement.matches?.('input,textarea,select')) {
        document.activeElement.blur();
      }
      step = n;
      lastField = null;
      form.dataset.quickStep = n;
      tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(order[i] === n)));
      if (n === '23') editor.showExtra('Макет23');
      else editor.showMain();
      if (focusFirst) focus(fields()[0]);
      else {
        form.querySelector('.dt-viewport')?.scrollTo({top:0,behavior:'instant'});
        alignIme();
      }
    }
    function next(el) {
      const controls = fields();
      const index = controls.findIndex(field => field === el || (el?.id && field.id === el.id));
      if (index < 0 && controls.length) return focus(controls[0]);
      const successor = index >= 0 ? controls[index + 1] : undefined;
      if (successor) {
        // Maket 10 can rebuild a row on change. Resolve the next cell again.
        const ids = controls.slice(index+1).map(item=>item.id);
        el?.blur();
        const visible = fields();
        const nextField = ids.map(id=>visible.find(item=>item.id===id)).find(Boolean);
        if(nextField)return focus(nextField);
      }
      const following = order[order.indexOf(step) + 1];
      if (following) go(following, true);
      else form.querySelector('#ce-save').focus();
    }
    form.addEventListener('focusin', event => {
      if (fields().includes(event.target)) {
        lastField = event.target;
        caretToEnd(event.target);
      }
    });
    form.addEventListener('click',event=>{
      const field=event.target;
      if(!form.dataset.quickStep||!fields().includes(field))return;
      caretToEnd(field);
      // A WebView tap may adjust the cursor after focusin/click; keep
      // the established fast-entry caret-at-end behaviour.
      queueMicrotask(()=>{if(document.activeElement===field)caretToEnd(field);});
      requestAnimationFrame(()=>{if(document.activeElement===field)caretToEnd(field);});
    });
    form.addEventListener('keydown', event => {
      if (!form.dataset.quickStep || event.key !== 'Enter' || event.isComposing || !event.target.matches('[data-ce-field], [data-species-for]')) return;
      if (form.querySelector('#ce-assist:not([hidden]):not(:empty), #v35-forest-group-dialog')) return;
      event.preventDefault();
      event.stopPropagation();
      next(event.target);
    });
    form.addEventListener('submit', event => {
      const active = document.activeElement;
      if(!form.dataset.quickStep || event.submitter===form.querySelector('#ce-save') || !fields().includes(active)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      next(active);
    }, true);
    const enter = button('Ввод ↵', () => next(lastField), 'quick-card-enter');
    enter.addEventListener('pointerdown', event => event.preventDefault());
    nav.append(...tabs, button('Все макеты', () => {
      delete form.dataset.quickStep;
      editor.showMaketNavigator();
    }), enter);
    form.querySelector('.dt-toolbar').after(nav);
    // The original SKU flags P31/PF1/P10 do NOT establish which makets
    // are mandatory. Do not turn them into false "required" maket chips.
    // Show a compact evidence status, and leave navigation to "Все макеты".
    const maketHint=document.createElement('div');
    maketHint.id='ce-required-makets';
    maketHint.setAttribute('role','status');
    maketHint.setAttribute('aria-live','polite');
    nav.after(maketHint);
    const updateMaketHint=()=>{
      if(!form.isConnected)return;
      const code=form.querySelector('[data-ce-scope="base"][data-ce-field="KU"]')?.value;
      const p=window.SolinCategoryRules?.profile?.(code,window.SOLIN_REFS?.tables);
      const requirements=window.SolinCategoryRules?.maketRequirements?.(code,window.SOLIN_REFS?.tables);
      maketHint.replaceChildren();
      if(!p?.code){maketHint.hidden=true;return;}
      maketHint.hidden=false;
      maketHint.dataset.maketRequirementStatus=requirements?.status||'unverified';
      const title=document.createElement('strong');
      title.textContent='Категория '+p.code+(p.name?' · '+p.name:'');
      maketHint.append(title);
      const note=document.createElement('small');
      note.textContent=requirements?.reason||
        'Обязательные макеты не подтверждены исходными правилами настольного SOLI-N. Откройте нужный макет через «Все макеты».';
      maketHint.append(note);
    };
    form.addEventListener('change',event=>{
      if(event.target.matches('[data-ce-scope="base"][data-ce-field="KU"]'))queueMicrotask(updateMaketHint);
    });
    window.addEventListener('solin-refs-ready',updateMaketHint);
    updateMaketHint();
    go('base');
  }

  const escape = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const value = (name, val) => '<label><span>' + name + '</span><output>' + escape(val) + '</output></label>';
  const cells = (record, columns) => columns.map(([name,key]) => value(name,displayValue('Выдел',key,record[key]))).join('');
  const block = (id, record, columns) => '<div class="kt-block"><b>' + id + '</b>' + cells(record,columns) + '</div>';
  const stand = [['Ярус','IAR'],['Коэф.','KOEF'],['Порода','POR'],['А, лет','LET'],['Н, м','PH'],['Д, см','PD2'],['Класс товар.','KT'],['Происхожд.','PROI'],['Полнота','POL'],['Пл. сеч.','SPS'],['Запас, м³/га','ZAP']];
  const decimal = new Intl.NumberFormat('en-US', {
    useGrouping:false, minimumFractionDigits:1, maximumFractionDigits:1
  });
  function displayValue(form, key, raw) {
    const kind = window.SolinFieldTypes?.type(form, key);
    if (!['float','double','currency','numeric'].includes(kind) ||
        raw == null || String(raw).trim() === '') return raw;
    const number = Number(String(raw).replace(',', '.'));
    return Number.isFinite(number) ? decimal.format(number) : raw;
  }

  function preview(record, forest) {
    const groups = Object.entries(record._children || {}).filter(([key,rows]) =>
      /^Макет\d+$/.test(key) && key !== 'Макет10' && rows.length);
    const rows = (record._children?.Макет10 || []).map(row =>
      '<tr>' + stand.map(([,key]) => '<td>' + escape(displayValue('Макет10',key,row[key])) + '</td>').join('') + '</tr>').join('');
    const additional = groups.flatMap(([key, entries]) => entries.map(row => {
      const columns = (D.transfSchema[key] || Object.keys(row)).filter(field =>
        !['POS','LESN','KV','KGLF','VD'].includes(field));
      return '<div class="kt-extra-row"><b>' + key.slice(5) + '</b>' +
        Array.from({length:Math.max(8, columns.length)}, (_, i) => '<output>' + escape(displayValue(key,columns[i],row[columns[i]])) + '</output>').join('') + '</div>';
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

  function openKT(records, index = 0) {
    const arrows = records.length > 1;
    openModal('ВыделКрат', '<div class="kt-view"></div>', {confirmChanges:false});
    const view = document.querySelector('#modalBody .kt-view');
    const sheet = document.createElement('div');
    sheet.className = 'kt-sheet-scroll';
    const nav = document.createElement('nav');
    nav.className = 'kt-review-nav';
    nav.setAttribute('aria-label','Просмотр выделов квартала');
    const previous = button('← Предыдущий', () => move(-1));
    const next = button('Следующий →', () => move(1));
    const status = document.createElement('span');
    status.setAttribute('aria-live','polite');
    if (arrows) view.append(nav);
    nav.append(previous,status,next);
    view.append(sheet);
    function render() {
      const record = records[index];
      const forest = D.lesnichestvo?.find(item => String(item.POS) === String(record.POS) && String(item.LESN) === String(record.LESN));
      sheet.innerHTML = preview(record,forest);
      sheet.scrollTop = 0;
      sheet.querySelector('#kt-exit').onclick = () => closeModal();
      status.textContent = 'Выдел ' + record.VD + ' · ' + (index + 1) + ' из ' + records.length;
      previous.disabled = index === 0;
      next.disabled = index === records.length - 1;
    }
    function move(delta) {
      if (index + delta < 0 || index + delta >= records.length) return;
      index += delta;
      render();
    }
    if (arrows) view.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    });
    render();
    if (arrows) next.focus();
  }

  function mountQuarterKT(key) {
    const quarter = document.querySelector('#quarters');
    const records = D.quarters?.[key]?.compartments;
    if (!quarter?.querySelector('.quarter-head-actions') || !records || quarter.querySelector('.kt-quarter-button')) return;
    const ordered = [...records].sort((a,b) =>
      String(a.VD).localeCompare(String(b.VD),'ru',{numeric:true}) ||
      String(a.KGLF).localeCompare(String(b.KGLF),'ru',{numeric:true}));
    const control = button('КТ', () => openKT(ordered), 'v37-new-stand-button kt-button kt-quarter-button');
    control.disabled = ordered.length === 0;
    control.setAttribute('aria-label','КТ — просмотр выделов квартала');
    const toolbar=quarter.querySelector('#wfQuarterToolbar');
    toolbar?.prepend(control);
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
    if (!footer.querySelector('.kt-button'))
      footer.append(button('КТ', () => openKT([current]), 'v37-new-stand-button kt-button'));
  }

  window.SolinQuickCard = {mount};
  function init() {
    const openQuarter = window.openQuarter;
    window.openQuarter = function(key,...args) {
      const result = openQuarter.call(this,key,...args);
      queueMicrotask(() => mountQuarterKT(key));
      return result;
    };
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
