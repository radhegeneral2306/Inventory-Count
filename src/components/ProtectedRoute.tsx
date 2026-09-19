import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types'

export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { firebaseUser, profile, loading } = useAuth()

  if (loading) return <div className="page-center"><div className="spinner" role="status" aria-label="Loading" /></div>
  if (!firebaseUser || !profile) return <Navigate to="/login" replace />
  if (profile.role !== role) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/staff'} replace />
  }

  return <>{children}</>
}
