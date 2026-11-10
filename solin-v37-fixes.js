/* SOLI-N Field V37: stable startup, internal Android Back and new stand
 * in currently opened quarter. No direct writes to IndexedDB or MDB here.
 */
(() => {
  'use strict';
  const ROOTS = new Set(['mainScreen', 'homeScreen']);
  const historyStack = [];
  let navigatingBack = false, bootUnlocked = false;

  const activeScreen = () => document.querySelector('.screen.active')?.id || null;
  function openDialog() {
    const modal = document.getElementById('modal');
    if (modal && !modal.classList.contains('hidden')) return true;
    if (document.getElementById('solin-v23-leave-confirm')) return true;
    if (document.getElementById('v35-forest-group-dialog')) return true;
    const assist = document.getElementById('ce-assist');
    if (assist && !assist.hidden) return true;
    return !!document.querySelector('[role="dialog"][aria-modal="true"]:not(#modal):not([hidden])');
  }
  function route(id) {
    return typeof id === 'string' && document.getElementById(id)?.classList.contains('screen');
  }
  function navigateBack() {
    if (openDialog()) return true; // Closing is possible ONLY via the visible X.
    const currentScreen = activeScreen();
    if (!currentScreen || ROOTS.has(currentScreen)) {
      window.toast?.('Вы в главном меню');
      return true; // NEVER let Android exit an app on a single Back.
    }
    let previous = null;
    while (historyStack.length) {
      const candidate = historyStack.pop();
      if (candidate !== currentScreen && route(candidate)) {previous = candidate;break;}
    }
    previous ||= route('mainScreen') ? 'mainScreen' : 'homeScreen';
    navigatingBack = true;
    try {
      if (typeof window.show === 'function') window.show(previous);
      else {
        document.querySelector('.screen.active')?.classList.remove('active');
        document.getElementById(previous)?.classList.add('active');
      }
    } finally {navigatingBack = false;}
    return true;
  }
  function installNavigation() {
    const old = window.show;
    if (typeof old !== 'function' || old.__v37Navigation) return;
    const wrapped = function(id, ...args) {
      const before = activeScreen();
      const result = old.call(this, id, ...args);
      if (!navigatingBack && before && before !== id && route(before) &&
        route(id) && historyStack.at(-1) !== before) {
        historyStack.push(before);
        if (historyStack.length > 40) historyStack.shift();
      }
      return result;
    };
    wrapped.__v37Navigation = true;
    window.show = wrapped;
  }
  window.SolinV37Navigation = {
    handleBack: navigateBack,
    get historyLength(){return historyStack.length;},
    get current(){return activeScreen();}
  };

  function selectedStand() {
    return typeof current !== 'undefined' ? current : null;
  }
  function activeDatabase() {
    return typeof D !== 'undefined' ? D : null;
  }
  function newStand() {
    if (openDialog()) return;
    const record = selectedStand(), db = activeDatabase();
    if (!record || !db?.quarters) {window.toast?.('Сначала откройте выдел');return;}
    const quarter = db.quarters[String(record.KV)];
    if (!quarter) {window.toast?.('Не найден исходный квартал');return;}
    const alreadySaved = (quarter.compartments || []).some(row =>
      row === record || (String(row.VD) === String(record.VD) &&
      String(row.KGLF ?? '') === String(record.KGLF ?? '') &&
      String(row.POS) === String(record.POS) &&
      String(row.LESN) === String(record.LESN)));
    if (!alreadySaved) {
      window.toast?.('Сначала сохраните текущий новый выдел');
      return;
    }
    if (typeof window.openCompForm !== 'function') {
      window.toast?.('Не удалось открыть форму нового выдела');
      return;
    }
    // Reuse the proven original creation flow. It allocates a free VD and
    // a NEW card with empty child Makets in the CURRENT KV/KGLF and forestry.
    window.openCompForm(String(record.KV), record.KGLF ?? null);
  }
  function addNewStandButton() {
    const workspace = document.querySelector('#card > .workspace');
    if (!workspace || workspace.querySelector('#v37-new-stand')) return;
    const button = document.createElement('button');
    button.id = 'v37-new-stand';
    button.type = 'button';
    button.className = 'v37-new-stand';
    button.textContent = '＋ Новая';
    button.setAttribute('aria-label','Новая — создать выдел в текущем квартале');
    button.addEventListener('click', newStand);
    workspace.appendChild(button);
  }
  function enhanceMaket3() {
    const form = document.querySelector('#modal.ce-modal #ce-form');
    const s3 = form?.querySelector('#ce-section-3');
    if (!s3 || form.dataset.v37SingleM3 === '1') return;
    // This is a strong invariant: the source markup has just one real select
    // for each attribute, both in Maket 3 and none under the stand table.
    const fields=['M3Pr','M3TLU'];
    for (const field of fields) {
      const controls = form.querySelectorAll('[data-ce-scope="base"][data-ce-field="'+field+'"]');
      if (controls.length !== 1 || !s3.contains(controls[0])) return;
    }
    form.dataset.v37SingleM3 = '1';
    for (const field of fields) {
      const el=s3.querySelector('[data-ce-scope="base"][data-ce-field="'+field+'"]');
      const holder=el.closest('.dt-cell') || el.closest('.ce-field')?.parentElement;
      if (!holder || holder.querySelector('[data-v35-open="'+field+'"]')) continue;
      const search=document.createElement('button');
      search.type='button';
      search.className='v37-source-search';
      search.dataset.v35Open=field;
      search.textContent='⌕ Выбрать';
      search.setAttribute('aria-label',field==='M3Pr'?
        'Поиск главной породы по справочнику':'Поиск типа леса по справочнику');
      holder.append(search);
    }
  }

  function revealWhenReady() {
    if (bootUnlocked) return;
    const menu = document.querySelector('#mainScreen .v33-main-layout');
    const fallback = document.getElementById('homeScreen');
    if (!menu && !fallback) return;
    // Reveal only an assembled main menu, or the intentionally selected
    // forestry-start screen; never paint the old prototype menu.
    if (!menu && activeScreen() === 'mainScreen') return;
    bootUnlocked = true;
    document.documentElement.classList.add('v37-ready');
    document.getElementById('v37-splash')?.remove();
  }
  function init() {
    installNavigation();
    addNewStandButton();
    const modal=document.getElementById('modal');
    if(modal) {
      const observer=new MutationObserver(enhanceMaket3);
      observer.observe(modal,{childList:true,subtree:true});
      enhanceMaket3();
    }
    const observer=new MutationObserver(revealWhenReady);
    observer.observe(document.body,{childList:true,subtree:true});
    revealWhenReady();
    // If initialization fails, expose a safe route to forestry selection,
    // never the old prototype menu and never an endless splash.
    window.setTimeout(() => {
      if (bootUnlocked) return;
      const splash=document.getElementById('v37-splash');
      const status=splash?.querySelector('[data-v37-status]');
      if(status)status.textContent='Интерфейс не загрузился. Откройте выбор лесничества.';
      if(splash && !splash.querySelector('[data-v37-recover]')) {
        const retry=document.createElement('button');
        retry.type='button';
        retry.dataset.v37Recover='1';
        retry.textContent='Выбор лесничества';
        retry.addEventListener('click', () => {
          document.querySelector('.screen.active')?.classList.remove('active');
          document.getElementById('homeScreen')?.classList.add('active');
          document.documentElement.classList.add('v37-ready');
          splash.remove();
          bootUnlocked=true;
        });
        splash.append(retry);
      }
    }, 8000);
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
