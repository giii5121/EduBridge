import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';
export default function ThemeToggle({ showLabel = false }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap';
  return (
    <button
      type="button"
      className={`theme-toggle ${showLabel ? 'with-label' : 'icon-button'}`}
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={dark}
      title={label}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
      {showLabel && <span>{dark ? 'Mode terang' : 'Mode gelap'}</span>}
    </button>
  );
}
