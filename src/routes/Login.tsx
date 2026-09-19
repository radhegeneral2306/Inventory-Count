import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { CubeFocus, WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { LanguageToggle } from '../components/LanguageToggle'

export function Login() {
  const { login, firebaseUser, profile, loading } = useAuth()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && firebaseUser && profile) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/staff'} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(false)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-center">
      <div className="login-card glass">
        <div className="login-icon">
          <CubeFocus size={27} weight="bold" />
        </div>
        <div className="login-heading">
          <h1>{t.appName}</h1>
          <p>{t.loginSubtitle}</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            {t.email}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder={t.emailPlaceholder}
              required
            />
          </label>
          <label>
            {t.password}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder={t.passwordPlaceholder}
              required
            />
          </label>
          {error && (
            <p className="error-text">
              <WarningCircle size={16} weight="bold" />
              {t.loginFailed}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? t.signingIn : t.signIn}
          </button>
        </form>
        <div className="login-toggles">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
