import { Desktop, Moon, Sun } from '@phosphor-icons/react'
import { useTheme, type ThemePreference } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'

const options: { value: ThemePreference; Icon: typeof Sun }[] = [
  { value: 'light', Icon: Sun },
  { value: 'system', Icon: Desktop },
  { value: 'dark', Icon: Moon },
]

export function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  const { t } = useLanguage()

  const labels: Record<ThemePreference, string> = {
    light: t.themeLight,
    system: t.themeSystem,
    dark: t.themeDark,
  }

  return (
    <div className="segmented" role="group" aria-label={t.colourTheme}>
      {options.map(({ value, Icon }) => (
        <button
          key={value}
          type="button"
          className={`segmented-option${preference === value ? ' active' : ''}`}
          aria-pressed={preference === value}
          title={labels[value]}
          onClick={() => setPreference(value)}
        >
          <Icon size={16} weight={preference === value ? 'fill' : 'regular'} />
          <span className="sr-only">{labels[value]}</span>
        </button>
      ))}
    </div>
  )
}
