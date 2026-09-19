import { useState, type ChangeEvent } from 'react'
import { parseTallyExcel, type ParsedItem } from '../lib/importExcel'
import { createSessionWithItems } from '../lib/stockData'
import { useAuth } from '../context/AuthContext'

export function ImportPanel({ onImported }: { onImported: (sessionId: string) => void }) {
  const { profile } = useAuth()
  const [sessionName, setSessionName] = useState('')
  const [parsed, setParsed] = useState<ParsedItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const items = await parseTallyExcel(file)
      if (items.length === 0) {
        setError('No item rows detected in this file. Try a different export or check the format.')
      }
      setParsed(items)
      if (!sessionName) setSessionName(file.name.replace(/\.[^.]+$/, ''))
    } catch {
      setError('Could not read this file. Make sure it is a valid Excel export.')
    }
  }

  function updateRow(index: number, field: keyof ParsedItem, value: string) {
    setParsed((rows) =>
      rows.map((row, i) =>
        i === index
          ? { ...row, [field]: field === 'tallyQty' ? Number(value) : value }
          : row,
      ),
    )
  }

  function removeRow(index: number) {
    setParsed((rows) => rows.filter((_, i) => i !== index))
  }

  async function confirmImport() {
    if (!profile || parsed.length === 0) return
    setSaving(true)
    try {
      const sessionId = await createSessionWithItems(sessionName || 'Stock Count', parsed, profile.uid)
      setParsed([])
      setSessionName('')
      onImported(sessionId)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="import-panel">
      <h2>Import Tally Excel Export</h2>
      <label>
        Session name
        <input value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
      </label>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void handleFile(e)} />
      {error && <p className="error-text">{error}</p>}

      {parsed.length > 0 && (
        <>
          <p>
            Review the {parsed.length} parsed rows below and fix anything before importing —
            Tally exports sometimes include stray header/subtotal rows.
          </p>
          <table className="stock-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Unit</th>
                <th>Tally Qty</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parsed.map((row, i) => (
                <tr key={i}>
                  <td>
                    <input
                      value={row.itemName}
                      onChange={(e) => updateRow(i, 'itemName', e.target.value)}
                    />
                  </td>
                  <td>
                    <input value={row.unit} onChange={(e) => updateRow(i, 'unit', e.target.value)} />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.tallyQty}
                      onChange={(e) => updateRow(i, 'tallyQty', e.target.value)}
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => removeRow(i)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => void confirmImport()} disabled={saving}>
            {saving ? 'Importing...' : `Import ${parsed.length} items`}
          </button>
        </>
      )}
    </div>
  )
}
