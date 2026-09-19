import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle, MagnifyingGlass, Tray } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { TopBar } from '../components/TopBar'
import { listenSessions, listenStockCounts, listenStockItems, setLiveCount } from '../lib/stockData'
import { useDebouncedCallback } from '../lib/useDebouncedCallback'
import type { StockCount, StockItem, StockSession } from '../types'

export function StaffView() {
  const { profile } = useAuth()
  const [sessions, setSessions] = useState<StockSession[]>([])
  const [sessionId, setSessionId] = useState<string>('')
  const [items, setItems] = useState<StockItem[]>([])
  const [counts, setCounts] = useState<StockCount[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)

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

  const myItems = useMemo(
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

  const valueFor = useCallback(
    (itemId: string) => {
      const draft = drafts[itemId]
      if (draft !== undefined) return draft
      const existing = countByItemId.get(itemId)
      return existing ? String(existing.liveQty) : ''
    },
    [drafts, countByItemId],
  )

  const done = useMemo(
    () => myItems.filter((item) => valueFor(item.id).trim() !== '').length,
    [myItems, valueFor],
  )

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return myItems.filter((item) => {
      if (query && !item.itemName.toLowerCase().includes(query)) return false
      if (pendingOnly && valueFor(item.id).trim() !== '') return false
      return true
    })
  }, [myItems, search, pendingOnly, valueFor])

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

  const percent = myItems.length === 0 ? 0 : Math.round((done / myItems.length) * 100)

  return (
    <>
      <TopBar title="Live Count" />

      <div className="page">
        {sessions.length > 1 && (
          <div className="toolbar">
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
          </div>
        )}

        {sessionId && myItems.length > 0 && (
          <>
            <div className="stat glass">
              <div className="stat-head">
                <span className={`stat-chip${percent === 100 ? ' is-success' : ''}`}>
                  <CheckCircle size={15} weight="bold" />
                </span>
                <span className="stat-label">
                  {done} of {myItems.length} counted
                </span>
              </div>
              <span className="stat-value">{percent}%</span>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${percent}%` }} />
              </div>
            </div>

            <div className="toolbar">
              <div className="search-field">
                <MagnifyingGlass size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search items"
                  aria-label="Search items"
                />
              </div>
              <button
                type="button"
                className={pendingOnly ? 'btn-primary' : ''}
                aria-pressed={pendingOnly}
                onClick={() => setPendingOnly((v) => !v)}
              >
                <CheckCircle size={16} weight="bold" />
                Pending only
              </button>
            </div>
          </>
        )}

        {!sessionId && (
          <div className="table-wrap glass">
            <div className="empty-state">
              <Tray size={30} />
              No active stock count yet. Ask your admin to import the Tally stock.
            </div>
          </div>
        )}

        {sessionId && visibleItems.length > 0 && (
          <div className="table-wrap glass">
            <div className="table-scroll">
              <table className="stock-table stacked">
                <thead>
                  <tr>
                    <th className="plain-head">Item</th>
                    <th className="plain-head">Unit</th>
                    <th className="plain-head" style={{ textAlign: 'right' }}>
                      Live Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const value = valueFor(item.id)
                    return (
                      <tr key={item.id}>
                        <td className="item-name">{item.itemName}</td>
                        <td data-label="Unit">{item.unit || '-'}</td>
                        <td data-label="Count">
                          <input
                            className={`count-input${value.trim() !== '' ? ' filled' : ''}`}
                            type="number"
                            inputMode="decimal"
                            value={value}
                            placeholder="0"
                            onChange={(e) => handleChange(item, e.target.value)}
                            aria-label={`Live count for ${item.itemName}`}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sessionId && myItems.length > 0 && visibleItems.length === 0 && (
          <div className="table-wrap glass">
            <div className="empty-state">
              <CheckCircle size={30} />
              {pendingOnly ? 'Everything here is counted.' : 'No items match that search.'}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
