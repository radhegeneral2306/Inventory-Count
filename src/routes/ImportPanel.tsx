import { useState, type ChangeEvent } from 'react'
import { CheckCircle, FileArrowUp, Trash, WarningCircle } from '@phosphor-icons/react'
import { parseTallyExcel, type ParsedItem } from '../lib/importExcel'
import { createSessionWithItems } from '../lib/stockData'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export function ImportPanel({ onImported }: { onImported: (sessionId: string) => void }) {
  const { profile } = useAuth()
  const { t } = useLanguage()
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
        setError(t.noRowsDetected)
      }
      setParsed(items)
      if (!sessionName) setSessionName(file.name.replace(/\.[^.]+$/, ''))
    } catch {
      setError(t.couldNotRead)
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
    <div className="card glass">
      <h2>{t.importTitle}</h2>
      <div className="form-grid">
        <label>
          {t.listName}
          <input value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
        </label>
        <div className="field-group">
          <span className="field-label">{t.file}</span>
          <label className="file-drop" htmlFor="tally-file-input">
            <FileArrowUp size={18} />
            {parsed.length > 0 ? t.replaceFile : t.chooseFile}
          </label>
          <input
            id="tally-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => void handleFile(e)}
            style={{ display: 'none' }}
          />
        </div>
      </div>
      {error && (
        <p className="error-text">
          <WarningCircle size={16} weight="bold" />
          {error}
        </p>
      )}

      {parsed.length > 0 && (
        <>
          <p className="hint-text">{t.reviewRows(parsed.length)}</p>
          <div className="table-wrap inset-panel">
            <div className="table-scroll">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th className="plain-head">{t.item}</th>
                    <th className="plain-head">{t.unit}</th>
                    <th className="plain-head">{t.tallyQty}</th>
                    <th className="plain-head"></th>
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
                        <button
                          type="button"
                          className="btn-ghost icon-btn"
                          onClick={() => removeRow(i)}
                          aria-label={t.removeRow}
                        >
                          <Trash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button type="button" className="btn-primary self-start" onClick={() => void confirmImport()} disabled={saving}>
            <CheckCircle size={16} weight="bold" />
            {saving ? t.importing : t.importItems(parsed.length)}
          </button>
        </>
      )}
    </div>
  )
}
