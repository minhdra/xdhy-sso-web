import { create } from "zustand";

import {
  getFontSizeMode,
  getThemeModeFromCookie,
  setFontSizeModeCookie,
  setThemeModeCookie,
  type FontSizeMode,
  type ThemeMode,
} from "../theme";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  fontSizeMode: FontSizeMode;
  setFontSizeMode: (mode: FontSizeMode) => void;
}

const apply = (mode: ThemeMode) => {
  document.documentElement.setAttribute("data-theme", mode);
  setThemeModeCookie(mode);
};

const applyFontSize = (mode: FontSizeMode) => {
  document.documentElement.setAttribute("data-font-size", mode);
  setFontSizeModeCookie(mode);
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: getThemeModeFromCookie(),
  setMode: (mode) => {
    apply(mode);
    set({ mode });
  },
  toggle: () => {
    const next: ThemeMode = get().mode === "dark" ? "light" : "dark";
    apply(next);
    set({ mode: next });
  },
  fontSizeMode: getFontSizeMode(),
  setFontSizeMode: (fontSizeMode) => {
    applyFontSize(fontSizeMode);
    set({ fontSizeMode });
  },
}));
