import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const THEME_PRESETS = [
  { name: 'Flame',   value: '#FF8C00' },
  { name: 'Ocean',   value: '#3B82F6' },
  { name: 'Jade',    value: '#22C55E' },
  { name: 'Violet',  value: '#A855F7' },
  { name: 'Cherry',  value: '#EF4444' },
  { name: 'Teal',    value: '#14B8A6' },
] as const;

interface ThemeState {
  primaryColor:    string;
  setPrimaryColor: (color: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      primaryColor:    '#FF8C00',
      setPrimaryColor: (color) => {
        document.documentElement.style.setProperty('--color-primary', color);
        set({ primaryColor: color });
      },
    }),
    { name: 'otw-theme' },
  ),
);
