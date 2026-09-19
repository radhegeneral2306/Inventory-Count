import type { ReactNode } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export function TopBar({ title, children }: { title: string; children?: ReactNode }) {
  const { profile, logout } = useAuth()

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <h1>{title}</h1>
        <div className="topbar-user">
          {children}
          <span className="role-badge">{profile?.role}</span>
          <span className="topbar-name">{profile?.fullName}</span>
          <button type="button" className="btn-ghost icon-btn" onClick={() => void logout()} aria-label="Log out">
            <SignOut size={18} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
