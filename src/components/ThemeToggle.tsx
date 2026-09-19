import { Desktop, Moon, Sun } from '@phosphor-icons/react'
import { useTheme, type ThemePreference } from '../context/ThemeContext'

const options: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'System', Icon: Desktop },
  { value: 'dark', label: 'Dark', Icon: Moon },
]

export function ThemeToggle() {
  const { preference, setPreference } = useTheme()

  return (
    <div className="segmented" role="group" aria-label="Colour theme">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className={`segmented-option${preference === value ? ' active' : ''}`}
          aria-pressed={preference === value}
          title={label}
          onClick={() => setPreference(value)}
        >
          <Icon size={15} weight={preference === value ? 'fill' : 'regular'} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}
