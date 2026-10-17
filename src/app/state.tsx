import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loadSession, loadStore, persistSession, saveStore } from '../data/persist'
import { store } from '../data/store'
import { dictionaries, type Dictionary } from '../i18n/dictionaries'
import type { Locale, Theme } from '../domain/types'

loadStore()
loadSession()

type AppState = {
  locale: Locale
  theme: Theme
  t: Dictionary
  dir: 'ltr' | 'rtl'
  session: typeof store.session
  refresh: () => void
  setLocale: (locale: Locale) => void
  setTheme: (theme: Theme) => void
  store: typeof store
}

const Ctx = createContext<AppState | null>(null)

function readLocale(): Locale {
  const saved = localStorage.getItem('mada.locale')
  if (saved === 'ar' || saved === 'en') return saved
  return 'en'
}

function readTheme(): Theme {
  const saved = localStorage.getItem('mada.theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale)
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    saveStore()
    persistSession()
    setTick((n) => n + 1)
  }, [])

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem('mada.locale', next)
    setLocaleState(next)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem('mada.theme', next)
    setThemeState(next)
  }, [])

  const value = useMemo<AppState>(
    () => ({
      locale,
      theme,
      t: dictionaries[locale],
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      session: store.session,
      refresh,
      setLocale,
      setTheme,
      store,
    }),
    [locale, theme, refresh, setLocale, setTheme, tick],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMada(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMada must be inside provider')
  return ctx
}
