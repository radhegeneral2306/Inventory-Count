import type { ReactNode } from 'react'
import { CubeFocus, SignOut } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from './ThemeToggle'

export function TopBar({ title, children }: { title: string; children?: ReactNode }) {
  const { profile, logout } = useAuth()

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
          <ThemeToggle />
          <span className="role-badge">{profile?.role}</span>
          <span className="topbar-name">{profile?.fullName}</span>
          <button
            type="button"
            className="btn-ghost icon-btn"
            onClick={() => void logout()}
            aria-label="Log out"
            title="Log out"
          >
            <SignOut size={18} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
