import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  htmlLangAttribute,
  translations,
  type Language,
  type TranslationKeys,
} from '../i18n/translations'

interface LanguageContextValue {
  language: Language
  setLanguage: (next: Language) => void
  t: TranslationKeys
}

const LanguageContext = createContext<LanguageContextValue | null>(null)
const STORAGE_KEY = 'stock-count-language'

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'roman' || stored === 'hi') return stored
  } catch {
    // Blocked storage: fall through to the default.
  }
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  useEffect(() => {
    document.documentElement.setAttribute('lang', htmlLangAttribute[language])
  }, [language])

  function setLanguage(next: Language) {
    setLanguageState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Choice just will not persist between visits.
    }
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
