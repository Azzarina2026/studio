/* Tema applicato prima del disegno della pagina (stessa preferenza di /preferiti). */
(function () {
  try {
    var t = localStorage.getItem('sa-theme') || 'dark';
    if (t === 'auto') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
