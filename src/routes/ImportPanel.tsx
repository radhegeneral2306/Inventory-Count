import { useMemo, useState, type ChangeEvent } from 'react'
import { CheckCircle, FileArrowUp, Trash, WarningCircle } from '@phosphor-icons/react'
import { parseTallyExcel, type ParsedItem } from '../lib/importExcel'
import { createSessionWithItems } from '../lib/stockData'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

/** A parsed row plus whether the admin has overridden what it was detected as. */
interface ReviewRow extends ParsedItem {
  isGroup: boolean
}

export function ImportPanel({ onImported }: { onImported: (sessionId: string) => void }) {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [sessionName, setSessionName] = useState('')
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [groupNames, setGroupNames] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const itemRows = useMemo(() => rows.filter((r) => !r.isGroup), [rows])

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setWarnings([])
    try {
      const result = await parseTallyExcel(file)
      if (result.items.length === 0) setError(t.noRowsDetected)
      setRows(result.items.map((item) => ({ ...item, isGroup: false })))
      setGroupNames(result.groups.map((g) => g.name))
      setWarnings(result.warnings)
      if (!sessionName) setSessionName(file.name.replace(/\.[^.]+$/, ''))
    } catch {
      setError(t.couldNotRead)
    }
  }

  function updateRow(index: number, patch: Partial<ReviewRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index))
  }

  async function confirmImport() {
    if (!profile || itemRows.length === 0) return
    setSaving(true)
    try {
      const toImport = itemRows.map((row, i) => ({
        itemName: row.itemName,
        unit: row.unit,
        tallyQty: row.tallyQty,
        groupName: row.groupName,
        sortIndex: i,
      }))
      const sessionId = await createSessionWithItems(sessionName || 'Stock Count', toImport, profile.uid)
      setRows([])
      setGroupNames([])
      setWarnings([])
      setSessionName('')
      onImported(sessionId)
    } finally {
      setSaving(false)
    }
  }

  const groupOptions = useMemo(() => {
    const fromRows = new Set(rows.map((r) => r.groupName).filter(Boolean))
    for (const name of groupNames) fromRows.add(name)
    return [...fromRows]
  }, [rows, groupNames])

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
            {rows.length > 0 ? t.replaceFile : t.chooseFile}
          </label>
          <input
            id="tally-file-input"
            type="file"
            accept=".xlsx,.xls"
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

      {rows.length > 0 && (
        <>
          <p className="hint-text">{t.parsedSummary(groupOptions.length, itemRows.length)}</p>

          {warnings.length > 0 && (
            <div className="notice glass">
              <WarningCircle size={20} weight="bold" />
              <span>
                {t.reconcileWarning}
                <br />
                {warnings.join(' · ')}
              </span>
            </div>
          )}

          <p className="hint-text">{t.reviewRows(itemRows.length)}</p>

          <div className="table-wrap inset-panel">
            <div className="table-scroll">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th className="plain-head">{t.item}</th>
                    <th className="plain-head">{t.group}</th>
                    <th className="plain-head">{t.tallyQty}</th>
                    <th className="plain-head">{t.rowType}</th>
                    <th className="plain-head"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={row.isGroup ? 'row-muted' : undefined}>
                      <td>
                        <input
                          value={row.itemName}
                          onChange={(e) => updateRow(i, { itemName: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          list="import-group-options"
                          value={row.groupName}
                          onChange={(e) => updateRow(i, { groupName: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.tallyQty}
                          onChange={(e) => updateRow(i, { tallyQty: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <select
                          value={row.isGroup ? 'group' : 'item'}
                          onChange={(e) => updateRow(i, { isGroup: e.target.value === 'group' })}
                        >
                          <option value="item">{t.rowTypeItem}</option>
                          <option value="group">{t.rowTypeGroup}</option>
                        </select>
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

          <datalist id="import-group-options">
            {groupOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <button
            type="button"
            className="btn-primary self-start"
            onClick={() => void confirmImport()}
            disabled={saving || itemRows.length === 0}
          >
            <CheckCircle size={16} weight="bold" />
            {saving ? t.importing : t.importItems(itemRows.length)}
          </button>
        </>
      )}
    </div>
  )
}
