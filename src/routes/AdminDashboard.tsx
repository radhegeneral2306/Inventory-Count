import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CaretDown,
  CaretUp,
  CaretUpDown,
  FilePdf,
  FileXls,
  UploadSimple,
  UsersThree,
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

const columns: { key: SortKey; label: string }[] = [
  { key: 'itemName', label: 'Item' },
  { key: 'unit', label: 'Unit' },
  { key: 'assignedSection', label: 'Section' },
  { key: 'tallyQty', label: 'Tally Qty' },
  { key: 'liveQty', label: 'Live Count' },
  { key: 'difference', label: 'Difference' },
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

  const currentSession = sessions.find((s) => s.id === sessionId)

  const [sortKey, setSortKey] = useState<SortKey>('itemName')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const sortedRows = useMemo(() => sortRows(rows, sortKey, sortDirection), [rows, sortKey, sortDirection])

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
      <TopBar title="Admin Dashboard">
        <Link to="/admin/users" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <UsersThree size={16} weight="bold" />
          Manage users
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
          <button type="button" className="btn-primary" onClick={() => setShowImport((v) => !v)}>
            {showImport ? <X size={16} weight="bold" /> : <UploadSimple size={16} weight="bold" />}
            {showImport ? 'Close import' : 'Import stock'}
          </button>
          {rows.length > 0 && (
            <>
              <button type="button" onClick={() => exportExcel(rows, currentSession?.name ?? 'stock-count')}>
                <FileXls size={16} weight="bold" />
                Export Excel
              </button>
              <button type="button" onClick={() => exportPdf(rows, currentSession?.name ?? 'stock-count')}>
                <FilePdf size={16} weight="bold" />
                Export PDF
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

        {!showImport && sessionId && (
          <div className="table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  {columns.map((col) => {
                    const isActive = sortKey === col.key
                    return (
                      <th key={col.key}>
                        <button type="button" className="sort-button" onClick={() => handleSort(col.key)}>
                          {col.label}
                          <span className={`sort-icon${isActive ? ' active' : ''}`}>
                            {isActive ? (
                              sortDirection === 'asc' ? (
                                <CaretUp size={12} weight="bold" />
                              ) : (
                                <CaretDown size={12} weight="bold" />
                              )
                            ) : (
                              <CaretUpDown size={12} />
                            )}
                          </span>
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.itemName}</td>
                    <td>{row.unit}</td>
                    <td>{row.assignedSection ?? '-'}</td>
                    <td className="num-cell">{row.tallyQty}</td>
                    <td className="num-cell">{row.liveQty === null ? '-' : row.liveQty}</td>
                    <td
                      className={`num-cell ${row.difference === null ? '' : row.difference === 0 ? 'diff-zero' : row.difference > 0 ? 'diff-positive' : 'diff-negative'}`}
                    >
                      {row.difference === null ? '-' : row.difference > 0 ? `+${row.difference}` : row.difference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!showImport && !sessionId && (
          <div className="table-wrap empty-state">No stock sessions yet. Import a Tally export to get started.</div>
        )}
      </div>
    </>
  )
}
