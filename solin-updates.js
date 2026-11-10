/* SOLI-N Field V23+ updater. One tap checks GitHub Releases, then hands
 * a verified APK to the Android installer. Never edits forest or MDB data.
 * No polling, background downloads or silent installs.
 */
(() => {
  'use strict';
  const REPO = 'amantaev0990-code/solin-field';
  const RELEASES = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  const FALLBACK = 'https://raw.githubusercontent.com/' + REPO + '/updater-channel/latest.json';
  const APP_ID = 'kz.solin.field.v23build';
  const ASSET_NAME = 'SOLIN-Field-update.apk';
  const PREFIX = '/'+REPO+'/releases/download/';
  let busy = false;
  function showStatus(message) {
    const el = document.getElementById('solin-update-status');
    if (el) el.textContent = String(message);
  }
  function plugin() {
    const native = window.Capacitor?.isNativePlatform?.();
    if (!native) return null;
    return window.Capacitor?.Plugins?.SolinUpdate || null;
  }
  // Retry GitHub API's documented transient 504 responses as well as
  // the Android release-asset stream. Source URL and SHA-256 checks stay strict.
  const temporaryHttp = new Set([408, 429, 500, 502, 503, 504]);
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function latestRelease(fetcher = window.fetch.bind(window), fallbackFetcher = window.fetch.bind(window)) {
    let response;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await fetcher(RELEASES, {
          cache: 'no-store', headers: { Accept: 'application/vnd.github+json' }
        });
      } catch (error) {
        if (attempt === 3) throw error;
        await pause(750 * attempt);
        continue;
      }
      if (!temporaryHttp.has(response.status) || attempt === 3) break;
      await pause(750 * attempt);
    }
    if (response.status === 404) return null; // No published releases yet.
    if (response.status === 403 || response.status === 429) {
      let alternate;
      try {
        alternate = await fallbackFetcher(FALLBACK, {cache:'no-store', redirect:'error'});
      } catch {
        throw new Error('GitHub ограничил проверку. Открой страницу последнего выпуска.');
      }
      if (!alternate.ok) throw new Error('Не удалось проверить GitHub (HTTP '+response.status+').');
      return validateRelease(await alternate.json());
    }
    if (!response.ok) throw new Error('Не удалось проверить GitHub (HTTP '+response.status+').');
    return validateRelease(await response.json());
  }
  function validateRelease(release) {
    if (release.draft || release.prerelease) return null;
    const version = /^solin-field-v(\d{2,10})$/i.exec(release.tag_name || '');
    if (!version) throw new Error('Неверное обозначение версии в GitHub Releases.');
    const code = Number(version[1]);
    if (!Number.isSafeInteger(code) || code < 24) throw new Error('Неверный код версии релиза.');
    const asset = (release.assets || []).find(a => a?.name === ASSET_NAME);
    if (!asset) throw new Error('В релизе отсутствует проверенный APK.');
    const digest = /^sha256:([a-f0-9]{64})$/i.exec(asset.digest || '');
    if (!digest) throw new Error('Релиз не содержит контрольную сумму SHA-256.');
    const url = new URL(asset.browser_download_url);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com'
      || url.pathname !== PREFIX + 'solin-field-v' + version[1] + '/' + ASSET_NAME
      || url.username || url.password || url.port) {
      throw new Error('Адрес APK не соответствует нашему GitHub.');
    }
    if (!Number.isSafeInteger(asset.size) || asset.size < 1024 || asset.size > 250*1024*1024) {
      throw new Error('Неожиданный размер APK.');
    }
    return { versionCode: code, url: url.toString(), sha256: digest[1] };
  }
  async function checkAndUpdate(fetcher) {
    if (busy) return;
    const native = plugin();
    if (!native) {
      showStatus('Обновления APK доступны только внутри Android-приложения.');
      return;
    }
    busy = true;
    const btn = document.getElementById('solin-update-button');
    if (btn) btn.disabled = true;
    try {
      showStatus('Проверяю версию в GitHub…');
      const info = await native.getInfo();
      if (info.packageId !== APP_ID) throw new Error('Это другая сборка приложения. Обновление остановлено.');
      const release = await latestRelease(fetcher || window.fetch.bind(window));
      if (!release || release.versionCode <= Number(info.versionCode)) {
        showStatus('Обновлений пока нет. Ваши данные не изменялись.');
        return;
      }
      showStatus('Найдено обновление. Скачиваю и проверяю подпись…');
      const requestId = 'solin-'+Date.now();
      let progressHandle = null;
      try {
        if (typeof native.addListener === 'function') {
          try {
            progressHandle = await native.addListener('updateProgress', event => {
              if (event?.requestId !== requestId) return;
              if (event.phase === 'retry') {
                showStatus('GitHub временно не отвечает. Повторяю загрузку: попытка '+
                  (Number(event.downloaded)+1)+' из '+event.total+'…');
              } else if (event.phase === 'download' && Number(event.total) > 1024) {
                const pct = Math.max(0, Math.min(100,
                  Math.round(Number(event.downloaded) * 100 / Number(event.total))));
                showStatus('Загрузка APK: '+pct+'%. Данные лесничеств не затрагиваются.');
              } else if (event.phase === 'verify') {
                showStatus('Проверяю подлинность и подпись APK…');
              }
            });
          } catch { /* A missing progress channel must never block updating. */ }
        }
        const result = await native.installRelease({
          url: release.url, sha256: release.sha256,
          versionCode: release.versionCode, requestId
        });
        if (!result?.installerOpened) throw new Error('Установщик Android не открылся.');
      } finally {
        try { await progressHandle?.remove?.(); } catch { /* UI-only listener. */ }
      }
      showStatus('Подтверди обновление в Android. Данные приложения сохраняются при успешном обновлении.');
    } catch (error) {
      showStatus(error?.message || 'Ошибка проверки. Попробуй позже.');
    } finally {
      busy = false;
      if (btn) btn.disabled = false;
    }
  }
  function mount() {
    const host = document.querySelector('#menuScreen .workspace');
    if (!host || document.getElementById('solin-update-button')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'solin-update-button';
    button.className = 'menuRow';
    // Fixed markup, no remote text is injected into the DOM.
    button.innerHTML = '<span><b>Проверить обновления</b><small id="solin-update-status">Проверка GitHub по нажатию, без фоновой загрузки</small></span><span>↻</span>';
    button.addEventListener('click', () => { void checkAndUpdate(); });
    host.appendChild(button);
  }
  window.SolinUpdates = { mount, latestRelease, checkAndUpdate };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else mount();
})();
