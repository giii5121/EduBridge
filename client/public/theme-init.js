// Run before the first paint so a saved dark theme never flashes a light page.
(() => {
  let saved = null;
  try {
    const value = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('edubridge_theme='))
      ?.split('=')[1];
    if (value === 'light' || value === 'dark') saved = value;
  } catch {
    /* The page can still be themed when browser cookies are unavailable. */
  }
  const theme =
    saved ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = saved ?? 'system';
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#101722' : '#132e46');
})();
