import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowClockwise, CheckCircle, CloudSlash, MagnifyingGlass, Tray } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { TopBar } from '../components/TopBar'
import { listenSessions, listenStockCounts, listenStockItems, setLiveCount } from '../lib/stockData'
import { useDebouncedCallback } from '../lib/useDebouncedCallback'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import type { StockCount, StockItem, StockSession } from '../types'

type SaveState = 'saving' | 'saved' | 'error'

export function StaffView() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const online = useOnlineStatus()

  const [sessions, setSessions] = useState<StockSession[]>([])
  const [sessionId, setSessionId] = useState<string>('')
  const [items, setItems] = useState<StockItem[]>([])
  const [counts, setCounts] = useState<StockCount[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})
  const [search, setSearch] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({})

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

  const persist = useCallback(
    async (itemId: string, value: number, assignedSection: string | null) => {
      if (!profile) return
      setSaveStates((s) => ({ ...s, [itemId]: 'saving' }))
      try {
        await setLiveCount(sessionId, itemId, value, profile.uid, assignedSection)
        setSaveStates((s) => ({ ...s, [itemId]: 'saved' }))
      } catch {
        setSaveStates((s) => ({ ...s, [itemId]: 'error' }))
      }
    },
    [profile, sessionId],
  )

  const save = useDebouncedCallback(persist, 600)

  function handleChange(item: StockItem, raw: string) {
    setDrafts((d) => ({ ...d, [item.id]: raw }))
    const value = Number(raw)
    if (raw.trim() === '' || Number.isNaN(value)) return
    setSaveStates((s) => ({ ...s, [item.id]: 'saving' }))
    save(item.id, value, item.assignedSection)
  }

  function retry(item: StockItem) {
    const value = Number(valueFor(item.id))
    if (Number.isNaN(value)) return
    void persist(item.id, value, item.assignedSection)
  }

  /** Enter moves to the next item so staff can count without hunting for fields. */
  function focusNext(index: number) {
    const next = visibleItems[index + 1]
    if (!next) return
    inputsRef.current[next.id]?.focus()
    inputsRef.current[next.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const percent = myItems.length === 0 ? 0 : Math.round((done / myItems.length) * 100)

  return (
    <>
      <TopBar title={t.liveCountTitle} />

      <div className="page">
        {!online && (
          <div className="notice glass">
            <CloudSlash size={20} weight="bold" />
            <span>{t.offlineNotice}</span>
          </div>
        )}

        {sessions.length > 1 && (
          <label className="field-inline">
            {t.stockList}
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {sessionId && myItems.length > 0 && (
          <div className="sticky-tools">
            <div className="stat glass progress-card">
              <div className="progress-row">
                <span className="stat-label">{t.countedOf(done, myItems.length)}</span>
                <span className="progress-percent">{percent}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${percent}%` }} />
              </div>
            </div>

            <div className="tool-row">
              <div className="search-field">
                <MagnifyingGlass size={18} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.searchItems}
                  aria-label={t.searchItems}
                />
              </div>
              <button
                type="button"
                className={pendingOnly ? 'btn-primary' : ''}
                aria-pressed={pendingOnly}
                onClick={() => setPendingOnly((v) => !v)}
              >
                {pendingOnly ? t.showAll : t.pendingOnly}
              </button>
            </div>
          </div>
        )}

        {!sessionId && (
          <div className="table-wrap glass">
            <div className="empty-state">
              <Tray size={32} />
              {t.noActiveSession}
            </div>
          </div>
        )}

        {sessionId && visibleItems.length > 0 && (
          <ul className="count-list">
            {visibleItems.map((item, index) => {
              const value = valueFor(item.id)
              const state = saveStates[item.id]
              const filled = value.trim() !== ''
              return (
                <li key={item.id} className={`count-card glass${filled ? ' is-done' : ''}`}>
                  <div className="count-card-main">
                    <span className="count-item-name">{item.itemName}</span>
                    {item.unit && <span className="count-unit">{item.unit}</span>}
                  </div>
                  <div className="count-card-entry">
                    <input
                      ref={(el) => {
                        inputsRef.current[item.id] = el
                      }}
                      className={`count-input${filled ? ' filled' : ''}`}
                      type="number"
                      inputMode="decimal"
                      enterKeyHint="next"
                      value={value}
                      placeholder="0"
                      onChange={(e) => handleChange(item, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          focusNext(index)
                        }
                      }}
                      aria-label={`${t.count}: ${item.itemName}`}
                    />
                    <span className={`save-state${state ? ` is-${state}` : ''}`}>
                      {state === 'saving' && <span className="dot-pulse" aria-label={t.saving} />}
                      {state === 'saved' && <CheckCircle size={20} weight="fill" aria-label={t.saved} />}
                      {state === 'error' && (
                        <button type="button" className="btn-ghost icon-btn retry" onClick={() => retry(item)} title={t.notSaved}>
                          <ArrowClockwise size={18} weight="bold" />
                        </button>
                      )}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {sessionId && myItems.length > 0 && visibleItems.length === 0 && (
          <div className="table-wrap glass">
            <div className="empty-state">
              <CheckCircle size={32} weight="fill" />
              {pendingOnly ? t.allCounted : t.noSearchMatch}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
