(function () {
  try {
    var theme = localStorage.getItem('prospectly:theme');
    var root = document.documentElement;
    var isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    root.dataset.theme = isDark ? 'dark' : 'light';
    var metaScheme = document.querySelector('meta[name="color-scheme"]');
    if (metaScheme) metaScheme.setAttribute('content', isDark ? 'dark' : 'light');
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', isDark ? '#090a0c' : '#f0ebf7');
  } catch (e) {
    /* private mode / blocked storage */
  }
})();
