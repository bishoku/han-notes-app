export type AppTheme = 'light' | 'dark' | 'nord' | 'dracula' | 'synthwave' | 'retro';
export type AppLanguage = 'en' | 'tr';

export function applyAppTheme(theme: AppTheme) {
  const root = document.documentElement;
  // Clear any existing dark or custom theme classes first
  root.classList.remove('dark', 'theme-nord', 'theme-dracula', 'theme-synthwave', 'theme-retro');

  if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    if (theme !== 'dark') {
      root.classList.add(`theme-${theme}`);
    }
  }
}
