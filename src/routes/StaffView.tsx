import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listenSessions, listenStockCounts, listenStockItems, setLiveCount } from '../lib/stockData'
import { useDebouncedCallback } from '../lib/useDebouncedCallback'
import type { StockCount, StockItem, StockSession } from '../types'

export function StaffView() {
  const { profile, logout } = useAuth()
  const [sessions, setSessions] = useState<StockSession[]>([])
  const [sessionId, setSessionId] = useState<string>('')
  const [items, setItems] = useState<StockItem[]>([])
  const [counts, setCounts] = useState<StockCount[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    return listenSessions((all) => {
      const open = all.filter((s) => s.status === 'open')
      setSessions(open)
      setSessionId((current) => current || open[0]?.id || '')
    })
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setItems([])
      setCounts([])
      return
    }
    const unsubItems = listenStockItems(sessionId, setItems)
    const unsubCounts = listenStockCounts(sessionId, setCounts)
    return () => {
      unsubItems()
      unsubCounts()
    }
  }, [sessionId])

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) => item.assignedSection === null || item.assignedSection === profile?.fullName,
      ),
    [items, profile?.fullName],
  )

  const countByItemId = useMemo(() => {
    const map = new Map<string, StockCount>()
    for (const c of counts) map.set(c.id, c)
    return map
  }, [counts])

  const save = useDebouncedCallback(async (itemId: string, value: number, assignedSection: string | null) => {
    if (!profile) return
    await setLiveCount(sessionId, itemId, value, profile.uid, assignedSection)
  }, 500)

  function handleChange(item: StockItem, raw: string) {
    setDrafts((d) => ({ ...d, [item.id]: raw }))
    const value = Number(raw)
    if (raw.trim() === '' || Number.isNaN(value)) return
    save(item.id, value, item.assignedSection)
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Live Stock Count</h1>
        <div>
          <span>{profile?.fullName}</span>
          <button type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>

      {sessions.length > 1 && (
        <label>
          Session
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!sessionId && <p>No active stock-count session yet. Ask admin to import stock.</p>}

      {sessionId && (
        <table className="stock-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Unit</th>
              <th>Live Count</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => {
              const existing = countByItemId.get(item.id)
              const draft = drafts[item.id] ?? (existing ? String(existing.liveQty) : '')
              return (
                <tr key={item.id}>
                  <td>{item.itemName}</td>
                  <td>{item.unit}</td>
                  <td>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={draft}
                      onChange={(e) => handleChange(item, e.target.value)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
