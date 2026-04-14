import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'dark' | 'light';

interface ThemeState {
  primaryColor:    string;
  colorMode:       ColorMode;
  setPrimaryColor: (color: string) => void;
  setColorMode:    (mode: ColorMode) => void;
}

function applyMode(mode: ColorMode) {
  if (typeof document === 'undefined') return;
  if (mode === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      primaryColor:    '#FF8C00',
      colorMode:       'dark',
      setPrimaryColor: (color) => {
        document.documentElement.style.setProperty('--color-primary', color);
        set({ primaryColor: color });
      },
      setColorMode: (mode) => {
        applyMode(mode);
        set({ colorMode: mode });
      },
    }),
    { name: 'otw-theme' },
  ),
);
