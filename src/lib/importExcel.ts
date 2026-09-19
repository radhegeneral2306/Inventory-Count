import ExcelJS from 'exceljs'

export interface ParsedItem {
  itemName: string
  unit: string
  tallyQty: number
  groupName: string
  sortIndex: number
}

export interface ParsedGroup {
  name: string
  /** The subtotal the group row itself declared, when the export includes one. */
  declaredQty: number | null
}

export interface ParseResult {
  items: ParsedItem[]
  groups: ParsedGroup[]
  /** Populated when a group subtotal or the grand total disagrees with the items. */
  warnings: string[]
}

/**
 * Tally's Stock Group Summary carries its hierarchy in cell formatting rather
 * than in the text: a bold name is a group heading, and an indented name is an
 * item sitting inside the heading above it. An item at indent 0 belongs
 * directly to the report's own group.
 *
 * SheetJS cannot see either signal (its community build reads no font or
 * alignment), which is why this uses ExcelJS.
 */
export async function parseTallyExcel(file: File): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) return { items: [], groups: [], warnings: [] }

  const layout = readLayout(sheet)
  const items: ParsedItem[] = []
  const groups: ParsedGroup[] = []
  const declaredByGroup = new Map<string, number | null>()

  let currentGroup: string | null = null
  let grandTotal: number | null = null

  for (let rowNumber = layout.firstDataRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const nameCell = sheet.getCell(rowNumber, layout.nameColumn)
    const name = cellText(nameCell)
    if (!name) continue

    const qty = cellNumber(sheet.getCell(rowNumber, layout.qtyColumn))

    if (isTotalRow(name)) {
      if (grandTotal === null) grandTotal = qty
      continue
    }

    if (nameCell.font?.bold) {
      currentGroup = name
      if (!declaredByGroup.has(name)) {
        declaredByGroup.set(name, qty)
        groups.push({ name, declaredQty: qty })
      }
      continue
    }

    if (qty === null) continue

    const indent = nameCell.alignment?.indent ?? 0
    const groupName = indent > 0 && currentGroup ? currentGroup : layout.reportGroup

    items.push({
      itemName: name,
      unit: layout.unitColumn ? cellText(sheet.getCell(rowNumber, layout.unitColumn)) : '',
      tallyQty: qty,
      groupName,
      sortIndex: items.length,
    })
  }

  // The report's own group only counts as a group when items actually landed in it.
  if (items.some((i) => i.groupName === layout.reportGroup) && layout.reportGroup) {
    if (!groups.some((g) => g.name === layout.reportGroup)) {
      groups.push({ name: layout.reportGroup, declaredQty: null })
    }
  }

  return { items, groups, warnings: reconcile(items, groups, grandTotal) }
}

/**
 * Compares what was parsed against the subtotals Tally printed. A mismatch is
 * the signal that this export is shaped differently and the rule above has
 * misread it, so it is worth showing rather than swallowing.
 */
function reconcile(items: ParsedItem[], groups: ParsedGroup[], grandTotal: number | null): string[] {
  const warnings: string[] = []

  for (const group of groups) {
    if (group.declaredQty === null) continue
    const sum = items
      .filter((i) => i.groupName === group.name)
      .reduce((total, i) => total + i.tallyQty, 0)
    if (Math.abs(sum - group.declaredQty) > 0.001) {
      warnings.push(`${group.name}: Tally says ${group.declaredQty}, items add up to ${sum}`)
    }
  }

  if (grandTotal !== null) {
    const sum = items.reduce((total, i) => total + i.tallyQty, 0)
    if (Math.abs(sum - grandTotal) > 0.001) {
      warnings.push(`Grand total: Tally says ${grandTotal}, items add up to ${sum}`)
    }
  }

  return warnings
}

interface SheetLayout {
  nameColumn: number
  qtyColumn: number
  unitColumn: number | null
  firstDataRow: number
  reportGroup: string
}

/**
 * Locates the header row rather than assuming column positions, so an export
 * with extra columns (or a Units column, which this report type omits) still
 * lines up.
 */
function readLayout(sheet: ExcelJS.Worksheet): SheetLayout {
  let nameColumn = 1
  let qtyColumn = 2
  let unitColumn: number | null = null
  let headerRow = 0

  const maxScan = Math.min(sheet.rowCount, 30)
  for (let rowNumber = 1; rowNumber <= maxScan; rowNumber += 1) {
    for (let col = 1; col <= Math.max(sheet.columnCount, 6); col += 1) {
      const text = cellText(sheet.getCell(rowNumber, col)).toLowerCase()
      if (!text) continue
      if (text === 'particulars') {
        nameColumn = col
        headerRow = rowNumber
      } else if (text.startsWith('quantity')) {
        qtyColumn = col
        headerRow = Math.max(headerRow, rowNumber)
      } else if (text === 'units' || text === 'unit') {
        unitColumn = col
        headerRow = Math.max(headerRow, rowNumber)
      }
    }
  }

  return {
    nameColumn,
    qtyColumn,
    unitColumn,
    firstDataRow: headerRow > 0 ? headerRow + 1 : 1,
    reportGroup: readReportGroup(sheet, headerRow, nameColumn),
  }
}

/**
 * The group the report was run for. Tally's title block prints it on the line
 * directly above the report name ("Stock Group Summary"), after the company
 * name and address. Items at indent 0 belong to it.
 */
function readReportGroup(sheet: ExcelJS.Worksheet, headerRow: number, nameColumn: number): string {
  const lastTitleRow = headerRow > 0 ? headerRow - 1 : Math.min(sheet.rowCount, 12)

  for (let rowNumber = 1; rowNumber <= lastTitleRow; rowNumber += 1) {
    const text = cellText(sheet.getCell(rowNumber, nameColumn))
    if (!text.toLowerCase().includes('summary')) continue

    for (let above = rowNumber - 1; above >= 1; above -= 1) {
      const candidate = cellText(sheet.getCell(above, nameColumn))
      if (candidate) return candidate
    }
  }

  return ''
}

function isTotalRow(name: string): boolean {
  const lower = name.toLowerCase().trim()
  return lower === 'total' || lower.endsWith(' total') || lower.startsWith('grand total')
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((part) => part.text).join('').trim()
  }
  if (typeof value === 'object') return ''
  return String(value).trim()
}

function cellNumber(cell: ExcelJS.Cell): number | null {
  const value = cell.value
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim())
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}
