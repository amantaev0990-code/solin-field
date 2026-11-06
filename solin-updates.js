/* Independent updater UI for the "Ещё" screen; never reads or changes field data. */
(() => {
  'use strict';
  const policy = window.SolinUpdatePolicy;
  if (!policy) return;
  function mount() {
    const workspace = document.querySelector('#menuScreen .workspace');
    if (!workspace || document.getElementById('solin-update-button')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'solin-update-button';
    button.className = 'menuRow';
    const inner = document.createElement('span');
    const label = document.createElement('b');
    label.textContent = 'Проверить обновления';
    const status = document.createElement('small');
    status.id = 'solin-update-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Через GitHub · данные остаются на устройстве';
    inner.append(label, status);
    const arrow = document.createElement('span');
    arrow.textContent = '↻';
    button.append(inner, arrow);
    workspace.appendChild(button);

    let busy = false;
    const show = text => { status.textContent = text; };
    const plugin = () => window.Capacitor?.Plugins?.SolinUpdate;
    button.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      button.disabled = true;
      try {
        const native = plugin();
        if (!native || typeof native.getInfo !== 'function' || typeof native.installUpdate !== 'function') {
          show('Доступно в Android APK с модулем обновлений');
          return;
        }
        const info = await native.getInfo();
        if (info?.packageName !== policy.PACKAGE ||
            String(info?.certificateSha256 || '').toUpperCase() !== policy.CERT ||
            !Number.isSafeInteger(info.versionCode)) {
          show('Подпись или версия приложения не совпадает. Обновление запрещено.');
          return;
        }
        show('Проверяю наличие новой версии…');
        const response = await fetch(policy.RELEASE_API, {
          cache: 'no-store',
          headers: {Accept:'application/vnd.github+json'}
        });
        if (response.status === 404) {
          show('Обновлений пока нет');
          return;
        }
        if (!response.ok) throw new Error('GitHub: HTTP ' + response.status);
        const release = await response.json();
        const candidate = policy.selectCandidate(release, info.versionCode);
        if (!candidate) {
          show('Нет доступного совместимого обновления');
          return;
        }
        show('Загружаю проверенное обновление ' + candidate.tag + '…');
        // Only this explicit user gesture starts a download or an install request.
        await native.installUpdate({
          url: candidate.url,
          sha256: candidate.sha256,
          versionCode: candidate.versionCode,
          expectedSize: candidate.size
        });
        show('Проверь системное окно установки Android');
      } catch (error) {
        show('Обновление не выполнено: ' + String(error?.message || error).slice(0, 145));
      } finally {
        button.disabled = false;
        busy = false;
      }
    });
    const native = plugin();
    if (native?.addListener) {
      try {
        native.addListener('updateProgress', e => {
          if (busy && Number.isFinite(e.percent))
            show('Скачивание обновления: ' + Math.max(0, Math.min(100, Math.round(e.percent))) + '%');
        }).catch(() => {});
      } catch (_) { /* optional native event */ }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
