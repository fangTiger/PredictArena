'use client';

import { useEffect, useState } from 'react';

export type DisplayLanguage = 'en' | 'zh';
export type DisplayTheme = 'light' | 'dark';

interface DisplayControlsProps {
  language?: DisplayLanguage;
  theme?: DisplayTheme;
  onLanguageChange?: (language: DisplayLanguage) => void;
  onThemeChange?: (theme: DisplayTheme) => void;
}

const LANGUAGE_KEY = 'predictarena.language';
const THEME_KEY = 'predictarena.theme';

function readPreference<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window.localStorage.getItem(key);
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function applyPreferences(theme: DisplayTheme, language: DisplayLanguage): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  window.localStorage.setItem(THEME_KEY, theme);
  window.localStorage.setItem(LANGUAGE_KEY, language);
}

function MiniIcon({ name }: { name: 'globe' | 'moon' | 'sun' }) {
  const common = {
    'aria-hidden': true,
    className: 'mini-icon',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24'
  } as const;

  if (name === 'sun') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
      </svg>
    );
  }

  if (name === 'moon') {
    return (
      <svg {...common}>
        <path d="M20 14.8A7.6 7.6 0 0 1 9.2 4 8 8 0 1 0 20 14.8Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

export function DisplayControls({
  language,
  theme,
  onLanguageChange,
  onThemeChange
}: DisplayControlsProps) {
  const [internalLanguage, setInternalLanguage] = useState<DisplayLanguage>('en');
  const [internalTheme, setInternalTheme] = useState<DisplayTheme>('light');
  const activeLanguage = language ?? internalLanguage;
  const activeTheme = theme ?? internalTheme;

  useEffect(() => {
    const storedLanguage = readPreference(LANGUAGE_KEY, activeLanguage, ['en', 'zh'] as const);
    const storedTheme = readPreference(THEME_KEY, activeTheme, ['light', 'dark'] as const);
    setInternalLanguage(storedLanguage);
    setInternalTheme(storedTheme);
    onLanguageChange?.(storedLanguage);
    onThemeChange?.(storedTheme);
    applyPreferences(storedTheme, storedLanguage);
    // This effect intentionally hydrates persisted display preferences once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTheme(nextTheme: DisplayTheme) {
    setInternalTheme(nextTheme);
    onThemeChange?.(nextTheme);
    applyPreferences(nextTheme, activeLanguage);
  }

  function setLanguage(nextLanguage: DisplayLanguage) {
    setInternalLanguage(nextLanguage);
    onLanguageChange?.(nextLanguage);
    applyPreferences(activeTheme, nextLanguage);
  }

  return (
    <div className="topbar-tools" aria-label="Display controls">
      <button
        type="button"
        className="icon-button"
        onClick={() => setTheme(activeTheme === 'light' ? 'dark' : 'light')}
        aria-label="Toggle theme"
      >
        <MiniIcon name={activeTheme === 'light' ? 'sun' : 'moon'} />
        {activeTheme === 'light' ? 'Night' : 'Light'}
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={() => setLanguage(activeLanguage === 'en' ? 'zh' : 'en')}
      >
        <MiniIcon name="globe" />
        {activeLanguage === 'en' ? '中文' : 'EN'}
      </button>
    </div>
  );
}
