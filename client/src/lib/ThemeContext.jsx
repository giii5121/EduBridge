import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

const ThemeContext = createContext(null);
const isTheme = (value) => value === 'light' || value === 'dark';
function persistTheme(theme) {
  try {
    document.cookie = `edubridge_theme=${theme}; Max-Age=31536000; Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
  } catch {
    /* Keep the control usable if a browser blocks cookie writes. */
  }
}
export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    const saved = document.documentElement.dataset.themePreference;
    return isTheme(saved) ? saved : null;
  });
  const [systemTheme, setSystemTheme] = useState(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const theme = preference ?? systemTheme;
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.themePreference = preference ?? 'system';
    root.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#101722' : '#132e46');
  }, [theme, preference]);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const update = (event) => setSystemTheme(event.matches ? 'dark' : 'light');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  // Renew an existing preference on a visit, without overriding the OS on a first visit.
  useEffect(() => {
    if (preference) persistTheme(preference);
  }, [preference]);
  const setTheme = useCallback((next) => {
    if (!isTheme(next)) return;
    persistTheme(next);
    setPreference(next);
  }, []);
  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark') }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
