import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CaretDown,
  CaretUp,
  CaretUpDown,
  CheckCircle,
  Clock,
  FilePdf,
  FileXls,
  MagnifyingGlass,
  Package,
  Tray,
  UploadSimple,
  UsersThree,
  WarningDiamond,
  X,
} from '@phosphor-icons/react'
import { TopBar } from '../components/TopBar'
import {
  listenSessions,
  listenStockCounts,
  listenStockItems,
  listenTallyQuantities,
} from '../lib/stockData'
import { exportExcel, exportPdf } from '../lib/exportReport'
import { ImportPanel } from './ImportPanel'
import type { StockCount, StockItem, StockRow, StockSession, TallyQty } from '../types'

type SortKey = 'itemName' | 'unit' | 'assignedSection' | 'tallyQty' | 'liveQty' | 'difference'
type SortDirection = 'asc' | 'desc'

const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'itemName', label: 'Item' },
  { key: 'unit', label: 'Unit' },
  { key: 'assignedSection', label: 'Section' },
  { key: 'tallyQty', label: 'Tally Qty', numeric: true },
  { key: 'liveQty', label: 'Live Count', numeric: true },
  { key: 'difference', label: 'Difference', numeric: true },
]

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
  const [showImport, setShowImport] = useState(false)
  const [sessions, setSessions] = useState<StockSession[]>([])
  const [sessionId, setSessionId] = useState('')
  const [items, setItems] = useState<StockItem[]>([])
  const [tallyQuantities, setTallyQuantities] = useState<TallyQty[]>([])
  const [counts, setCounts] = useState<StockCount[]>([])
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('itemName')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  useEffect(() => {
    return listenSessions((all) => {
      setSessions(all)
      setSessionId((current) => current || all[0]?.id || '')
    })
  }, [])

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
    const countById = new Map(counts.map((c) => [c.id, c.liveQty]))
    return items.map((item) => {
      const tallyQty = tallyById.get(item.id) ?? 0
      const liveQty = countById.get(item.id) ?? null
      return {
        id: item.id,
        itemName: item.itemName,
        unit: item.unit,
        tallyQty,
        liveQty,
        difference: liveQty === null ? null : liveQty - tallyQty,
        assignedSection: item.assignedSection,
      }
    })
  }, [items, tallyQuantities, counts])

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

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = query
      ? rows.filter((r) => r.itemName.toLowerCase().includes(query))
      : rows
    return sortRows(filtered, sortKey, sortDirection)
  }, [rows, search, sortKey, sortDirection])

  const currentSession = sessions.find((s) => s.id === sessionId)

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
      <TopBar title="Stock Count">
        <Link to="/admin/users" className="btn-ghost icon-btn" aria-label="Manage users" title="Manage users">
          <UsersThree size={18} weight="bold" />
        </Link>
      </TopBar>

      <div className="page">
        <div className="toolbar">
          {sessions.length > 0 && (
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
          <span className="spacer" />
          <button type="button" className="btn-primary" onClick={() => setShowImport((v) => !v)}>
            {showImport ? <X size={16} weight="bold" /> : <UploadSimple size={16} weight="bold" />}
            {showImport ? 'Close' : 'Import stock'}
          </button>
          {rows.length > 0 && (
            <>
              <button type="button" onClick={() => exportExcel(rows, currentSession?.name ?? 'stock-count')}>
                <FileXls size={16} weight="bold" />
                Excel
              </button>
              <button type="button" onClick={() => exportPdf(rows, currentSession?.name ?? 'stock-count')}>
                <FilePdf size={16} weight="bold" />
                PDF
              </button>
            </>
          )}
        </div>

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
                  <span className="stat-label">Items</span>
                </div>
                <span className="stat-value">{stats.total}</span>
              </div>
              <div className="stat glass">
                <div className="stat-head">
                  <span className="stat-chip is-success">
                    <CheckCircle size={15} weight="bold" />
                  </span>
                  <span className="stat-label">Counted</span>
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
                  <span className="stat-label">Pending</span>
                </div>
                <span className="stat-value">{stats.pending}</span>
              </div>
              <div className="stat glass">
                <div className="stat-head">
                  <span className={`stat-chip${stats.variances > 0 ? ' is-danger' : ''}`}>
                    <WarningDiamond size={15} weight="bold" />
                  </span>
                  <span className="stat-label">Variances</span>
                </div>
                <span className="stat-value" style={{ color: stats.variances > 0 ? 'var(--danger)' : undefined }}>
                  {stats.variances}
                </span>
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
            </div>
          </>
        )}

        {!showImport && sessionId && visibleRows.length > 0 && (
          <div className="table-wrap glass">
            <div className="table-scroll">
              <table className="stock-table">
                <thead>
                  <tr>
                    {columns.map((col) => {
                      const isActive = sortKey === col.key
                      return (
                        <th key={col.key}>
                          <button
                            type="button"
                            className={`sort-button${col.numeric ? ' align-right' : ''}`}
                            onClick={() => handleSort(col.key)}
                          >
                            {col.label}
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
                      <td>{row.unit || '-'}</td>
                      <td>{row.assignedSection ?? '-'}</td>
                      <td className="num-cell">{row.tallyQty}</td>
                      <td className="num-cell">
                        {row.liveQty === null ? <span className="diff-empty">Pending</span> : row.liveQty}
                      </td>
                      <td className="num-cell">
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
              No items match that search.
            </div>
          </div>
        )}

        {!showImport && !sessionId && (
          <div className="table-wrap glass">
            <div className="empty-state">
              <Tray size={30} />
              No stock sessions yet. Import a Tally export to get started.
            </div>
          </div>
        )}
      </div>
    </>
  )
}
