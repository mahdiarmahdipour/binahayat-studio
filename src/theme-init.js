(() => {
  let theme = 'light';
  try { theme = localStorage.getItem('binahayat-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch {}
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
})();
