import * as XLSX from 'xlsx'

export interface ParsedItem {
  itemName: string
  unit: string
  tallyQty: number
}

/**
 * Reads the first sheet of a Tally stock export and pulls out (item, unit, qty) rows.
 * Tally exports mix in header rows, group/subtotal rows and blank rows, so this keeps
 * only rows that look like a real item line: a non-empty name plus a numeric quantity.
 */
export async function parseTallyExcel(file: File): Promise<ParsedItem[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })

  const items: ParsedItem[] = []

  for (const row of rows) {
    const cells = row.map((c) => (typeof c === 'string' ? c.trim() : c))
    const nameCell = cells.find((c) => typeof c === 'string' && c.length > 2)
    const numericCells = cells.filter((c) => typeof c === 'number')

    if (!nameCell || numericCells.length === 0) continue

    const lower = String(nameCell).toLowerCase()
    const isNoise =
      lower.includes('total') ||
      lower.includes('grand') ||
      lower.includes('closing stock') ||
      lower.includes('quantity') ||
      lower.includes('particulars')
    if (isNoise) continue

    const qty = numericCells[numericCells.length - 1]
    const unitCell = cells.find((c) => typeof c === 'string' && /^[a-zA-Z.]+$/.test(c) && c !== nameCell)

    items.push({
      itemName: String(nameCell),
      unit: unitCell ? String(unitCell) : '',
      tallyQty: Number(qty),
    })
  }

  return items
}
