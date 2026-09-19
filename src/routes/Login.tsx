import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { CubeFocus, WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'

export function Login() {
  const { login, firebaseUser, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && firebaseUser && profile) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/staff'} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch {
      setError('Login failed. Check your email and password.')
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
          <h1>Stock Count</h1>
          <p>Sign in to compare Tally stock against the live godown count.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@company.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Your password"
              required
            />
          </label>
          {error && (
            <p className="error-text">
              <WarningCircle size={16} weight="bold" />
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="login-theme">
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
