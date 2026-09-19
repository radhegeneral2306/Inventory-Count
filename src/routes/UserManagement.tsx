import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createUserAccount, listenUsers, updateUserProfile } from '../lib/userAdmin'
import type { Role, UserProfile } from '../types'

export function UserManagement() {
  const { profile: currentProfile } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [edits, setEdits] = useState<Record<string, { fullName: string; role: Role }>>({})
  const [savingUid, setSavingUid] = useState<string | null>(null)

  useEffect(() => listenUsers(setUsers), [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      await createUserAccount(email, password, fullName, role)
      setEmail('')
      setPassword('')
      setFullName('')
      setRole('staff')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the account.')
    } finally {
      setCreating(false)
    }
  }

  function getEdit(user: UserProfile) {
    return edits[user.uid] ?? { fullName: user.fullName, role: user.role }
  }

  function updateEdit(uid: string, patch: Partial<{ fullName: string; role: Role }>) {
    setEdits((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] ?? users.find((u) => u.uid === uid)!), ...patch },
    }))
  }

  async function saveEdit(uid: string) {
    const edit = edits[uid]
    if (!edit) return
    setSavingUid(uid)
    try {
      await updateUserProfile(uid, edit.fullName, edit.role)
      setEdits((prev) => {
        const { [uid]: _removed, ...rest } = prev
        return rest
      })
    } finally {
      setSavingUid(null)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>User Management</h1>
        <Link to="/admin">Back to dashboard</Link>
      </header>

      <form className="import-panel" onSubmit={(e) => void handleCreate(e)}>
        <h2>Create a new user</h2>
        <label>
          Full name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {createError && <p className="error-text">{createError}</p>}
        <button type="submit" disabled={creating}>
          {creating ? 'Creating...' : 'Create user'}
        </button>
      </form>

      <table className="stock-table">
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const edit = getEdit(user)
            const dirty = edit.fullName !== user.fullName || edit.role !== user.role
            const isSelf = user.uid === currentProfile?.uid
            return (
              <tr key={user.uid}>
                <td>
                  <input
                    value={edit.fullName}
                    onChange={(e) => updateEdit(user.uid, { fullName: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={edit.role}
                    onChange={(e) => updateEdit(user.uid, { role: e.target.value as Role })}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                  {isSelf && <span className="error-text"> (this is you)</span>}
                </td>
                <td>
                  <button type="button" disabled={!dirty || savingUid === user.uid} onClick={() => void saveEdit(user.uid)}>
                    {savingUid === user.uid ? 'Saving...' : 'Save'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
