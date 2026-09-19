import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './routes/Login'
import { StaffView } from './routes/StaffView'
import { AdminDashboard } from './routes/AdminDashboard'
import { UserManagement } from './routes/UserManagement'

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/staff"
            element={
              <ProtectedRoute role="staff">
                <StaffView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute role="admin">
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}

export default App
