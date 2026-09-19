import { useLanguage } from '../context/LanguageContext'
import { languageNames, languageShortNames, type Language } from '../i18n/translations'

const order: Language[] = ['en', 'roman', 'hi']

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="segmented" role="group" aria-label={t.language}>
      {order.map((value) => (
        <button
          key={value}
          type="button"
          className={`segmented-option is-text${language === value ? ' active' : ''}`}
          aria-pressed={language === value}
          title={languageNames[value]}
          onClick={() => setLanguage(value)}
        >
          {languageShortNames[value]}
        </button>
      ))}
    </div>
  )
}
