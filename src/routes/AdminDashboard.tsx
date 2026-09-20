import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CaretDown,
  CaretUp,
  CaretUpDown,
  CheckCircle,
  Clock,
  ArrowsDownUp,
  FilePdf,
  FileXls,
  MagnifyingGlass,
  Package,
  Trash,
  Tray,
  UploadSimple,
  UsersThree,
  WarningCircle,
  WarningDiamond,
  X,
} from '@phosphor-icons/react'
import { TopBar } from '../components/TopBar'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useLanguage } from '../context/LanguageContext'
import {
  listenSessions,
  listenStockCounts,
  listenStockItems,
  listenTallyQuantities,
  deleteSession,
} from '../lib/stockData'
import { listenUsers } from '../lib/userAdmin'
import { exportExcel, exportPdf } from '../lib/exportReport'
import { ImportPanel } from './ImportPanel'
import type { StockCount, StockItem, StockRow, StockSession, TallyQty, UserProfile } from '../types'

type SortKey =
  | 'itemName'
  | 'groupName'
  | 'unit'
  | 'tallyQty'
  | 'liveQty'
  | 'difference'
  | 'countedByName'
  | 'updatedAt'
type SortDirection = 'asc' | 'desc'

const columnKeys: { key: SortKey; numeric?: boolean }[] = [
  { key: 'itemName' },
  { key: 'groupName' },
  { key: 'unit' },
  { key: 'tallyQty', numeric: true },
  { key: 'liveQty', numeric: true },
  { key: 'difference', numeric: true },
  { key: 'countedByName' },
  { key: 'updatedAt', numeric: true },
]

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function sortRows(rows: StockRow[], key: SortKey, direction: SortDirection): StockRow[] {
  const sorted = [...rows].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]
    if (aVal === null) return bVal === null ? 0 : 1
    if (bVal === null) return -1
    if (typeof aVal === 'string' || typeof bVal === 'string') {
      return String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' })
    }
    return aVal - bVal
  })
  return direction === 'asc' ? sorted : sorted.reverse()
}

export function AdminDashboard() {
  const { t } = useLanguage()
  const [showImport, setShowImport] = useState(false)
  const [sessions, setSessions] = useState<StockSession[]>([])
  const [sessionId, setSessionId] = useState('')
  const [items, setItems] = useState<StockItem[]>([])
  const [tallyQuantities, setTallyQuantities] = useState<TallyQty[]>([])
  const [counts, setCounts] = useState<StockCount[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('itemName')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  useEffect(() => {
    return listenSessions((all) => {
      setSessions(all)
      setSessionId((current) => current || all[0]?.id || '')
    })
  }, [])

  useEffect(() => listenUsers(setUsers), [])

  const usersById = useMemo(() => new Map(users.map((u) => [u.uid, u.fullName])), [users])

  useEffect(() => {
    if (!sessionId) {
      setItems([])
      setTallyQuantities([])
      setCounts([])
      return
    }
    const unsubItems = listenStockItems(sessionId, setItems)
    const unsubTally = listenTallyQuantities(sessionId, setTallyQuantities)
    const unsubCounts = listenStockCounts(sessionId, setCounts)
    return () => {
      unsubItems()
      unsubTally()
      unsubCounts()
    }
  }, [sessionId])

  const rows = useMemo<StockRow[]>(() => {
    const tallyById = new Map(tallyQuantities.map((t) => [t.id, t.tallyQty]))
    const countById = new Map(counts.map((c) => [c.id, c]))
    return items.map((item) => {
      const tallyQty = tallyById.get(item.id) ?? 0
      const count = countById.get(item.id)
      const liveQty = count?.liveQty ?? null
      return {
        id: item.id,
        itemName: item.itemName,
        unit: item.unit,
        groupName: item.groupName,
        tallyQty,
        liveQty,
        difference: liveQty === null ? null : liveQty - tallyQty,
        assignedSection: item.assignedSection,
        countedByName: count ? (usersById.get(count.countedBy) ?? count.countedBy) : null,
        updatedAt: count?.updatedAt ?? null,
      }
    })
  }, [items, tallyQuantities, counts, usersById])

  const stats = useMemo(() => {
    const counted = rows.filter((r) => r.liveQty !== null).length
    const variances = rows.filter((r) => r.difference !== null && r.difference !== 0).length
    return {
      total: rows.length,
      counted,
      pending: rows.length - counted,
      variances,
      percent: rows.length === 0 ? 0 : Math.round((counted / rows.length) * 100),
    }
  }, [rows])

  const groupsInList = useMemo(() => {
    const names = new Set(rows.map((r) => r.groupName).filter(Boolean))
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      if (query && !r.itemName.toLowerCase().includes(query)) return false
      if (groupFilter && r.groupName !== groupFilter) return false
      return true
    })
    return sortRows(filtered, sortKey, sortDirection)
  }, [rows, search, groupFilter, sortKey, sortDirection])

  const currentSession = sessions.find((s) => s.id === sessionId)

  const columnLabels: Record<SortKey, string> = {
    itemName: t.item,
    groupName: t.group,
    unit: t.unit,
    tallyQty: t.tallyQty,
    liveQty: t.liveCount,
    difference: t.difference,
    countedByName: t.countedBy,
    updatedAt: t.countedAt,
  }

  async function handleDelete() {
    if (!sessionId) return
    setDeleting(true)
    setDeleteError(false)
    try {
      await deleteSession(sessionId)
      setConfirmDelete(false)
      // Pick whatever list the sessions listener still has, or fall back to empty.
      setSessionId((current) => (current === sessionId ? '' : current))
    } catch {
      setDeleteError(true)
    } finally {
      setDeleting(false)
    }
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  return (
    <>
      <TopBar title={t.adminTitle}>
        <Link to="/admin/users" className="btn-ghost icon-btn" aria-label={t.manageUsers} title={t.manageUsers}>
          <UsersThree size={18} weight="bold" />
        </Link>
      </TopBar>

      <div className="page">
        <div className="toolbar">
          {sessions.length > 0 && (
            <label>
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
          <span className="spacer" />
          <button type="button" className="btn-primary" onClick={() => setShowImport((v) => !v)}>
            {showImport ? <X size={16} weight="bold" /> : <UploadSimple size={16} weight="bold" />}
            {showImport ? t.close : t.importStock}
          </button>
          {rows.length > 0 && (
            <>
              <button type="button" onClick={() => void exportExcel(rows, currentSession?.name ?? 'stock-count')}>
                <FileXls size={16} weight="bold" />
                {t.exportExcel}
              </button>
              <button type="button" onClick={() => exportPdf(rows, currentSession?.name ?? 'stock-count')}>
                <FilePdf size={16} weight="bold" />
                {t.exportPdf}
              </button>
            </>
          )}
          {sessionId && (
            <button type="button" className="btn-danger-ghost" onClick={() => setConfirmDelete(true)}>
              <Trash size={16} weight="bold" />
              {t.deleteList}
            </button>
          )}
        </div>

        {deleteError && (
          <p className="error-text">
            <WarningCircle size={16} weight="bold" />
            {t.deleteFailed}
          </p>
        )}

        {showImport && (
          <ImportPanel
            onImported={(newSessionId) => {
              setSessionId(newSessionId)
              setShowImport(false)
            }}
          />
        )}

        {!showImport && rows.length > 0 && (
          <>
            <div className="stat-grid">
              <div className="stat glass">
                <div className="stat-head">
                  <span className="stat-chip">
                    <Package size={15} weight="bold" />
                  </span>
                  <span className="stat-label">{t.totalItems}</span>
                </div>
                <span className="stat-value">{stats.total}</span>
              </div>
              <div className="stat glass">
                <div className="stat-head">
                  <span className="stat-chip is-success">
                    <CheckCircle size={15} weight="bold" />
                  </span>
                  <span className="stat-label">{t.counted}</span>
                </div>
                <span className="stat-value">{stats.counted}</span>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${stats.percent}%` }} />
                </div>
              </div>
              <div className="stat glass">
                <div className="stat-head">
                  <span className="stat-chip">
                    <Clock size={15} weight="bold" />
                  </span>
                  <span className="stat-label">{t.pending}</span>
                </div>
                <span className="stat-value">{stats.pending}</span>
              </div>
              <div className="stat glass">
                <div className="stat-head">
                  <span className={`stat-chip${stats.variances > 0 ? ' is-danger' : ''}`}>
                    <WarningDiamond size={15} weight="bold" />
                  </span>
                  <span className="stat-label">{t.differences}</span>
                </div>
                <span className="stat-value" style={{ color: stats.variances > 0 ? 'var(--danger)' : undefined }}>
                  {stats.variances}
                </span>
              </div>
            </div>

            <div className="toolbar">
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
              {groupsInList.length > 1 && (
                <label className="field-inline">
                  <select
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    aria-label={t.group}
                  >
                    <option value="">{t.allGroups}</option>
                    {groupsInList.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {/* The table header collapses on phones, so sorting needs its own control there. */}
              <label className="field-inline mobile-only">
                <ArrowsDownUp size={18} />
                <select
                  value={`${sortKey}:${sortDirection}`}
                  onChange={(e) => {
                    const [key, dir] = e.target.value.split(':')
                    setSortKey(key as SortKey)
                    setSortDirection(dir as SortDirection)
                  }}
                  aria-label={t.sortBy}
                >
                  {columnKeys.map((col) => (
                    <optgroup key={col.key} label={columnLabels[col.key]}>
                      <option value={`${col.key}:asc`}>{`${columnLabels[col.key]} ${t.ascending}`}</option>
                      <option value={`${col.key}:desc`}>{`${columnLabels[col.key]} ${t.descending}`}</option>
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}

        {!showImport && sessionId && visibleRows.length > 0 && (
          <div className="table-wrap glass">
            <div className="table-scroll">
              <table className="stock-table stacked">
                <thead>
                  <tr>
                    {columnKeys.map((col) => {
                      const isActive = sortKey === col.key
                      return (
                        <th key={col.key}>
                          <button
                            type="button"
                            className={`sort-button${col.numeric ? ' align-right' : ''}`}
                            onClick={() => handleSort(col.key)}
                          >
                            {columnLabels[col.key]}
                            <span className={`sort-icon${isActive ? ' active' : ''}`}>
                              {isActive ? (
                                sortDirection === 'asc' ? (
                                  <CaretUp size={11} weight="bold" />
                                ) : (
                                  <CaretDown size={11} weight="bold" />
                                )
                              ) : (
                                <CaretUpDown size={11} />
                              )}
                            </span>
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td className="item-name">{row.itemName}</td>
                      <td data-label={t.group}>{row.groupName || '-'}</td>
                      <td data-label={t.unit}>{row.unit || '-'}</td>
                      <td className="num-cell" data-label={t.tallyQty}>
                        {row.tallyQty}
                      </td>
                      <td className="num-cell" data-label={t.liveCount}>
                        {row.liveQty === null ? <span className="diff-empty">{t.pending}</span> : row.liveQty}
                      </td>
                      <td className="num-cell" data-label={t.difference}>
                        {row.difference === null ? (
                          <span className="diff-empty">-</span>
                        ) : (
                          <span
                            className={`diff-pill ${row.difference === 0 ? 'diff-zero' : row.difference > 0 ? 'diff-positive' : 'diff-negative'}`}
                          >
                            {row.difference > 0 ? `+${row.difference}` : row.difference}
                          </span>
                        )}
                      </td>
                      <td data-label={t.countedBy}>{row.countedByName ?? <span className="diff-empty">-</span>}</td>
                      <td data-label={t.countedAt}>
                        {row.updatedAt === null ? (
                          <span className="diff-empty">-</span>
                        ) : (
                          formatTimestamp(row.updatedAt)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!showImport && sessionId && rows.length > 0 && visibleRows.length === 0 && (
          <div className="table-wrap glass">
            <div className="empty-state">
              <MagnifyingGlass size={28} />
              {t.noSearchMatch}
            </div>
          </div>
        )}

        {!showImport && !sessionId && (
          <div className="table-wrap glass">
            <div className="empty-state">
              <Tray size={30} />
              {t.noSessionsAdmin}
            </div>
          </div>
        )}

        {confirmDelete && currentSession && (
          <ConfirmDialog
            title={t.deleteListTitle}
            body={t.deleteListBody(currentSession.name, rows.length)}
            confirmLabel={deleting ? t.deleting : t.deleteList}
            cancelLabel={t.cancel}
            busy={deleting}
            onConfirm={() => void handleDelete()}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </div>
    </>
  )
}
