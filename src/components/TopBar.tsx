import { useState, type ReactNode } from 'react'
import { CubeFocus, DotsThreeVertical, SignOut, X } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { ThemeToggle } from './ThemeToggle'
import { LanguageToggle } from './LanguageToggle'

/**
 * On a phone there is no room for both toggles plus the account controls, so
 * everything except the title collapses behind a single menu button.
 */
export function TopBar({ title, children }: { title: string; children?: ReactNode }) {
  const { profile, logout } = useAuth()
  const { t } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand">
          <span className="brand-mark">
            <CubeFocus size={19} weight="bold" />
          </span>
          <h1>{title}</h1>
        </div>

        <div className="topbar-actions">
          {children}
          <div className="desktop-only topbar-actions">
            <LanguageToggle />
            <ThemeToggle />
            <span className="topbar-name">{profile?.fullName}</span>
            <button
              type="button"
              className="btn-ghost icon-btn"
              onClick={() => void logout()}
              aria-label={t.logOut}
              title={t.logOut}
            >
              <SignOut size={18} weight="bold" />
            </button>
          </div>
          <button
            type="button"
            className="btn-ghost icon-btn mobile-only"
            aria-expanded={menuOpen}
            aria-label={t.language}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={20} weight="bold" /> : <DotsThreeVertical size={22} weight="bold" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="topbar-sheet mobile-only">
          <div className="sheet-row">
            <span className="sheet-label">{t.language}</span>
            <LanguageToggle />
          </div>
          <div className="sheet-row">
            <span className="sheet-label">{t.colourTheme}</span>
            <ThemeToggle />
          </div>
          <div className="sheet-row">
            <span className="sheet-label">{profile?.fullName}</span>
            <button type="button" onClick={() => void logout()}>
              <SignOut size={17} weight="bold" />
              {t.logOut}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
