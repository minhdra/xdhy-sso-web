import { create } from 'zustand';

import { getThemeModeFromCookie, setThemeModeCookie, type ThemeMode } from '../theme';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const apply = (mode: ThemeMode) => {
  document.documentElement.setAttribute('data-theme', mode);
  setThemeModeCookie(mode);
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: getThemeModeFromCookie(),
  setMode: (mode) => {
    apply(mode);
    set({ mode });
  },
  toggle: () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    apply(next);
    set({ mode: next });
  },
}));
