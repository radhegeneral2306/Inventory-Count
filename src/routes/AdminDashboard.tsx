import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  listenSessions,
  listenStockCounts,
  listenStockItems,
  listenTallyQuantities,
} from '../lib/stockData'
import { exportExcel, exportPdf } from '../lib/exportReport'
import { ImportPanel } from './ImportPanel'
import type { StockCount, StockItem, StockRow, StockSession, TallyQty } from '../types'

export function AdminDashboard() {
  const { profile, logout } = useAuth()
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

  return (
    <div className="page">
      <header className="page-header">
        <h1>Admin Dashboard</h1>
        <div>
          <span>{profile?.fullName}</span>
          <button type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>

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
        <button type="button" onClick={() => setShowImport((v) => !v)}>
          {showImport ? 'Close import' : 'Import stock'}
        </button>
        {rows.length > 0 && (
          <>
            <button type="button" onClick={() => exportExcel(rows, currentSession?.name ?? 'stock-count')}>
              Export Excel
            </button>
            <button type="button" onClick={() => exportPdf(rows, currentSession?.name ?? 'stock-count')}>
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
        <table className="stock-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Unit</th>
              <th>Section</th>
              <th>Tally Qty</th>
              <th>Live Count</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.itemName}</td>
                <td>{row.unit}</td>
                <td>{row.assignedSection ?? '-'}</td>
                <td>{row.tallyQty}</td>
                <td>{row.liveQty === null ? '-' : row.liveQty}</td>
                <td className={row.difference === null ? '' : row.difference === 0 ? 'diff-zero' : row.difference > 0 ? 'diff-positive' : 'diff-negative'}>
                  {row.difference === null ? '-' : row.difference > 0 ? `+${row.difference}` : row.difference}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!showImport && !sessionId && <p>No stock sessions yet. Import a Tally export to get started.</p>}
    </div>
  )
}
