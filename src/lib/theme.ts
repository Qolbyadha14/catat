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
