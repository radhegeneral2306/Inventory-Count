import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { StockRow } from '../types'

const headers = ['Group', 'Item Name', 'Unit', 'Tally Qty', 'Live Count', 'Difference']

function cells(row: StockRow) {
  return [
    row.groupName,
    row.itemName,
    row.unit,
    row.tallyQty,
    row.liveQty ?? '',
    row.difference ?? '',
  ]
}

export async function exportExcel(rows: StockRow[], sessionName: string) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Stock Count')

  sheet.addRow(headers)
  sheet.getRow(1).font = { bold: true }
  for (const row of rows) sheet.addRow(cells(row))

  sheet.columns = [
    { width: 26 },
    { width: 40 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
  ]

  const buffer = await workbook.xlsx.writeBuffer()
  download(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${sessionName || 'stock-count'}.xlsx`,
  )
}

export function exportPdf(rows: StockRow[], sessionName: string) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(sessionName || 'Stock Count Report', 14, 15)

  autoTable(doc, {
    startY: 22,
    head: [headers],
    body: rows.map((row) => [
      row.groupName || '-',
      row.itemName,
      row.unit || '-',
      String(row.tallyQty),
      row.liveQty === null ? '-' : String(row.liveQty),
      row.difference === null ? '-' : row.difference > 0 ? `+${row.difference}` : String(row.difference),
    ]),
  })

  doc.save(`${sessionName || 'stock-count'}.pdf`)
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
