import { useEffect, useMemo, useState } from 'react';
import { ThemeContext } from './theme';

const STORAGE_KEY = 'theme';

// A saved choice wins; otherwise follow the operating system setting.
// index.html runs the same logic before React loads, so there is no flash.
const initialTheme = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can be unavailable (private mode); fall through.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // The markdown editor reads its colours from data-color-mode.
    root.setAttribute('data-color-mode', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Not critical: the theme just won't be remembered.
    }
  }, [theme]);

  const value = useMemo(
    () => ({ theme, isDark: theme === 'dark', toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
