import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowClockwise, CaretDown, CaretRight, CheckCircle, CloudSlash, MagnifyingGlass, Tray } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { TopBar } from '../components/TopBar'
import { clearLiveCount, listenSessions, listenStockCounts, listenStockItems, setLiveCount } from '../lib/stockData'
import { useDebouncedCallback } from '../lib/useDebouncedCallback'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import type { StockCount, StockItem, StockSession } from '../types'

type SaveState = 'saving' | 'saved' | 'error' | undefined

/** Item tagged with the stock list it came from, so "All" can mix several lists and still know where to write each count. */
type StaffItem = StockItem & { sessionId: string }

const ALL_SESSIONS = '__all__'

interface CountRowProps {
  item: StaffItem
  committedQty: number | null
  countLabel: string
  savingLabel: string
  savedLabel: string
  notSavedLabel: string
  onPersist: (sessionId: string, itemId: string, value: number, assignedSection: string | null) => Promise<void>
  onClear: (sessionId: string, itemId: string) => Promise<void>
  registerInput: (itemId: string, el: HTMLInputElement | null) => void
  onEnterNext: (itemId: string) => void
}

/**
 * Owns its own typing state so a keystroke re-renders only this row, not the
 * whole list. Before this split, every keystroke anywhere re-derived the
 * entire grouped list (done counts, filters, group membership) for every
 * item, which was slow enough on a phone that the input's real DOM value
 * would outrun React and later keystrokes visibly got dropped.
 */
const CountRow = memo(function CountRow({
  item,
  committedQty,
  countLabel,
  savingLabel,
  savedLabel,
  notSavedLabel,
  onPersist,
  onClear,
  registerInput,
  onEnterNext,
}: CountRowProps) {
  const [value, setValue] = useState(committedQty !== null ? String(committedQty) : '')
  const [saveState, setSaveState] = useState<SaveState>(undefined)

  // Reflects Firestore once it actually changes (our own debounced write
  // landing, or a genuinely different device). Typing itself never triggers
  // this, since the debounce holds off any commit until keystrokes pause.
  useEffect(() => {
    setValue(committedQty !== null ? String(committedQty) : '')
  }, [committedQty])

  const debouncedPersist = useDebouncedCallback((itemId: string, num: number) => {
    setSaveState('saved')
    onPersist(item.sessionId, itemId, num, item.assignedSection).catch(() => setSaveState('error'))
  }, 600)

  const debouncedClear = useDebouncedCallback((itemId: string) => {
    setSaveState(undefined)
    onClear(item.sessionId, itemId).catch(() => setSaveState('error'))
  }, 600)

  function handleChange(raw: string) {
    setValue(raw)
    if (raw.trim() === '') {
      setSaveState(undefined)
      debouncedClear(item.id)
      return
    }
    const num = Number(raw)
    if (Number.isNaN(num)) return
    setSaveState('saving')
    debouncedPersist(item.id, num)
  }

  function retry() {
    const num = Number(value)
    if (value.trim() === '') {
      setSaveState(undefined)
      onClear(item.sessionId, item.id).catch(() => setSaveState('error'))
      return
    }
    if (Number.isNaN(num)) return
    setSaveState('saved')
    onPersist(item.sessionId, item.id, num, item.assignedSection).catch(() => setSaveState('error'))
  }

  const filled = value.trim() !== ''

  return (
    <li className={`count-card glass${filled ? ' is-done' : ''}`}>
      <div className="count-card-main">
        <span className="count-item-name">{item.itemName}</span>
        {item.unit && <span className="count-unit">{item.unit}</span>}
      </div>
      <div className="count-card-entry">
        <input
          ref={(el) => registerInput(item.id, el)}
          className={`count-input${filled ? ' filled' : ''}`}
          type="number"
          inputMode="decimal"
          enterKeyHint="next"
          value={value}
          placeholder="0"
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onEnterNext(item.id)
            }
          }}
          aria-label={`${countLabel}: ${item.itemName}`}
        />
        <span className={`save-state${saveState ? ` is-${saveState}` : ''}`}>
          {saveState === 'saving' && <span className="dot-pulse" aria-label={savingLabel} />}
          {saveState === 'saved' && <CheckCircle size={20} weight="fill" aria-label={savedLabel} />}
          {saveState === 'error' && (
            <button type="button" className="btn-ghost icon-btn retry" onClick={retry} title={notSavedLabel}>
              <ArrowClockwise size={18} weight="bold" />
            </button>
          )}
        </span>
      </div>
    </li>
  )
})

export function StaffView() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const online = useOnlineStatus()

  const [sessions, setSessions] = useState<StockSession[]>([])
  const [sessionFilter, setSessionFilter] = useState<string>('')
  const [itemsBySession, setItemsBySession] = useState<Map<string, StockItem[]>>(new Map())
  const [countsBySession, setCountsBySession] = useState<Map<string, StockCount[]>>(new Map())
  const [search, setSearch] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    return listenSessions((all) => {
      const open = all.filter((s) => s.status === 'open')
      setSessions(open)
      setSessionFilter((current) => current || open[0]?.id || '')
    })
  }, [])

  // Every open list is listened to (not only the one currently shown), so
  // switching to "All" doesn't need to wait on a fresh subscription.
  const openSessionIdsKey = useMemo(() => sessions.map((s) => s.id).join(','), [sessions])

  useEffect(() => {
    const ids = openSessionIdsKey ? openSessionIdsKey.split(',') : []
    if (ids.length === 0) {
      setItemsBySession(new Map())
      setCountsBySession(new Map())
      return
    }
    const unsubs = ids.flatMap((id) => [
      listenStockItems(id, (items) => setItemsBySession((m) => new Map(m).set(id, items))),
      listenStockCounts(id, (counts) => setCountsBySession((m) => new Map(m).set(id, counts)), profile?.uid),
    ])
    return () => unsubs.forEach((unsub) => unsub())
  }, [openSessionIdsKey, profile?.uid])

  const activeSessionIds = useMemo(() => {
    if (sessionFilter === ALL_SESSIONS) return sessions.map((s) => s.id)
    return sessionFilter ? [sessionFilter] : []
  }, [sessionFilter, sessions])

  const myItems = useMemo(() => {
    const combined: StaffItem[] = []
    for (const id of activeSessionIds) {
      const sessionItems = itemsBySession.get(id) ?? []
      for (const item of sessionItems) {
        if (item.assignedSection === null || item.assignedSection === profile?.fullName) {
          combined.push({ ...item, sessionId: id })
        }
      }
    }
    return combined
  }, [activeSessionIds, itemsBySession, profile?.fullName])

  // Stock item document IDs are globally unique (Firestore auto-IDs), so a
  // single count map works across several lists at once with no collisions.
  const committedById = useMemo(() => {
    const map = new Map<string, number>()
    for (const id of activeSessionIds) {
      const sessionCounts = countsBySession.get(id) ?? []
      for (const c of sessionCounts) map.set(c.id, c.liveQty)
    }
    return map
  }, [activeSessionIds, countsBySession])

  // Deliberately driven only by what is actually saved in Firestore, not by
  // what is mid-typed in a row: this is what recomputes on nearly every
  // keystroke would otherwise re-derive over the whole list.
  const done = useMemo(
    () => myItems.filter((item) => committedById.has(item.id)).length,
    [myItems, committedById],
  )

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return myItems.filter((item) => {
      if (query && !item.itemName.toLowerCase().includes(query)) return false
      if (pendingOnly && committedById.has(item.id)) return false
      return true
    })
  }, [myItems, search, pendingOnly, committedById])

  /** Tally's own order is preserved, so groups come out in the order they were imported. */
  const sections = useMemo(() => {
    const order: string[] = []
    const byGroup = new Map<string, StaffItem[]>()
    for (const item of visibleItems) {
      const key = item.groupName || ''
      if (!byGroup.has(key)) {
        byGroup.set(key, [])
        order.push(key)
      }
      byGroup.get(key)!.push(item)
    }
    return order.map((name) => {
      const groupItems = byGroup.get(name)!
      const groupDone = groupItems.filter((i) => committedById.has(i.id)).length
      return { name, items: groupItems, done: groupDone }
    })
  }, [visibleItems, committedById])

  const handlePersist = useCallback(
    (sessionId: string, itemId: string, value: number, assignedSection: string | null) => {
      if (!profile) return Promise.resolve()
      return setLiveCount(sessionId, itemId, value, profile.uid, assignedSection)
    },
    [profile],
  )

  const handleClear = useCallback((sessionId: string, itemId: string) => {
    return clearLiveCount(sessionId, itemId)
  }, [])

  const registerInput = useCallback((itemId: string, el: HTMLInputElement | null) => {
    inputsRef.current[itemId] = el
  }, [])

  /** Enter moves to the next item so staff can count without hunting for fields. */
  const focusNext = useCallback(
    (itemId: string) => {
      const index = visibleItems.findIndex((i) => i.id === itemId)
      const next = visibleItems[index + 1]
      if (!next) return
      inputsRef.current[next.id]?.focus()
      inputsRef.current[next.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    },
    [visibleItems],
  )

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
            <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)}>
              <option value={ALL_SESSIONS}>{t.allLists}</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {sessionFilter && myItems.length > 0 && (
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

        {!sessionFilter && (
          <div className="table-wrap glass">
            <div className="empty-state">
              <Tray size={32} />
              {t.noActiveSession}
            </div>
          </div>
        )}

        {sessionFilter &&
          sections.map((section) => {
            const isCollapsed = collapsed[section.name] ?? false
            return (
              <section key={section.name || 'ungrouped'} className="count-section">
                {section.name && (
                  <button
                    type="button"
                    className="group-heading btn-ghost"
                    aria-expanded={!isCollapsed}
                    onClick={() => setCollapsed((c) => ({ ...c, [section.name]: !isCollapsed }))}
                  >
                    {isCollapsed ? <CaretRight size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
                    <span className="group-name">{section.name}</span>
                    <span className={`group-count${section.done === section.items.length ? ' is-done' : ''}`}>
                      {section.done}/{section.items.length}
                    </span>
                  </button>
                )}

                {!isCollapsed && (
                  <ul className="count-list">
                    {section.items.map((item) => (
                      <CountRow
                        key={item.id}
                        item={item}
                        committedQty={committedById.get(item.id) ?? null}
                        countLabel={t.count}
                        savingLabel={t.saving}
                        savedLabel={t.saved}
                        notSavedLabel={t.notSaved}
                        onPersist={handlePersist}
                        onClear={handleClear}
                        registerInput={registerInput}
                        onEnterNext={focusNext}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}

        {sessionFilter && myItems.length > 0 && visibleItems.length === 0 && (
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
