import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { StockRow } from '../types'

function reportRows(rows: StockRow[]) {
  return rows.map((r) => ({
    'Item Name': r.itemName,
    Unit: r.unit,
    'Tally Qty': r.tallyQty,
    'Live Count': r.liveQty ?? '',
    Difference: r.difference ?? '',
  }))
}

export function exportExcel(rows: StockRow[], sessionName: string) {
  const worksheet = XLSX.utils.json_to_sheet(reportRows(rows))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Count')
  XLSX.writeFile(workbook, `${sessionName || 'stock-count'}.xlsx`)
}

export function exportPdf(rows: StockRow[], sessionName: string) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(sessionName || 'Stock Count Report', 14, 15)

  autoTable(doc, {
    startY: 22,
    head: [['Item Name', 'Unit', 'Tally Qty', 'Live Count', 'Difference']],
    body: rows.map((r) => [
      r.itemName,
      r.unit,
      String(r.tallyQty),
      r.liveQty === null ? '-' : String(r.liveQty),
      r.difference === null ? '-' : (r.difference > 0 ? `+${r.difference}` : String(r.difference)),
    ]),
  })

  doc.save(`${sessionName || 'stock-count'}.pdf`)
}
