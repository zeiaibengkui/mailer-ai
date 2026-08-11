import { createContext, useContext } from 'react'

export type Mode = 'light' | 'dark'

export const STORAGE_KEY = 'mui-theme-mode'

export const ThemeModeContext = createContext<{ mode: Mode; toggle: () => void }>({
  mode: 'dark',
  toggle: () => {},
})

export function useThemeMode() {
  return useContext(ThemeModeContext)
}
