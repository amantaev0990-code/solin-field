/* Android compatibility only. No visual changes to the original SOLI-N site. */
(function () {
  'use strict';
  if (!window.SolinAndroid || window.__solinAndroidExportInstalled) return;
  window.__solinAndroidExportInstalled = true;
  const oldClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const a = this;
    if (!a.download || !a.href || !a.href.startsWith('blob:')) {
      return oldClick.apply(a, arguments);
    }
    fetch(a.href).then(r => r.blob()).then(blob => {
      const reader = new FileReader();
      reader.onload = function () {
        const encoded = String(reader.result || '').split(',')[1];
        if (encoded) window.SolinAndroid.saveBase64(a.download, encoded,
            blob.type || 'application/octet-stream');
      };
      reader.readAsDataURL(blob);
    }).catch(err => {
      console.error('Native export failed', err);
      oldClick.call(a);
    });
  };
})();
