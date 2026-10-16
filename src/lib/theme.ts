import { useState, useEffect } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(
  stored: string | null | undefined,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (stored === 'light') return 'light';
  if (stored === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const val = localStorage.getItem('theme');
    if (val === 'light' || val === 'dark' || val === 'system') return val;
  } catch {}
  return 'system';
}

export function applyTheme(mode: ThemeMode): ResolvedTheme {
  const systemPrefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = resolveTheme(mode, systemPrefersDark);

  if (typeof document !== 'undefined') {
    if (mode === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', mode);
    }

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    meta.setAttribute('content', bg || (resolved === 'dark' ? 'rgb(15, 23, 42)' : 'rgb(255, 255, 255)'));
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('theme', mode);
    } catch {}
  }

  return resolved;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);

    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const currentStored = getStoredTheme();
      if (currentStored === 'system') {
        applyTheme('system');
      }
    };

    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
  };

  return { theme, setTheme };
}
