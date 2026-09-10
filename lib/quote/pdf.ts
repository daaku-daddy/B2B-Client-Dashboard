'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { lineMath, quoteTotals } from '@/lib/domain/money'
import type { Quote, QuoteLine } from '@/lib/domain/types'

/**
 * The client-facing quote PDF.
 *
 * What the client sees is the MARKED-UP figure only. The Material Depot rate
 * and the architect's margin are the architect's business and appear nowhere in
 * this file — putting them in a "hidden" column or a light grey font would be
 * worse than not printing them, because a PDF gets forwarded.
 */
export function quotePdf(args: {
  quote: Quote
  lines: QuoteLine[]
  projectName: string
  clientName: string | null
  firmName: string
  firmContact?: string | null
  firmPhone?: string | null
  firmCity?: string | null
  firmGst?: string | null
}) {
  const { quote, lines, projectName, clientName, firmName } = args
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40

  const BRAND: [number, number, number] = [196, 88, 28]
  const INK: [number, number, number] = [32, 27, 22]
  const SOFT: [number, number, number] = [91, 81, 71]

  doc.setFillColor(...BRAND)
  doc.rect(0, 0, W, 4, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...INK)
  doc.text(firmName, M, 52)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SOFT)
  doc.text([args.firmContact, args.firmPhone, args.firmCity].filter(Boolean).join('  ·  '), M, 66)
  if (args.firmGst) doc.text(`GSTIN ${args.firmGst}`, M, 78)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BRAND)
  doc.text(`QUOTATION  v${quote.version}`, W - M, 52, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SOFT)
  doc.text(new Date(quote.created_at).toLocaleDateString('en-IN'), W - M, 66, { align: 'right' })
  if (quote.valid_until) {
    doc.text(`Valid until ${new Date(quote.valid_until).toLocaleDateString('en-IN')}`, W - M, 78, { align: 'right' })
  }

  doc.setDrawColor(233, 225, 214)
  doc.line(M, 92, W - M, 92)

  doc.setFontSize(9)
  doc.setTextColor(...SOFT)
  doc.text('FOR', M, 112)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(clientName ?? 'Client', M, 128)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SOFT)
  doc.text(projectName, M, 142)

  // Grouped by room, because that is how a client reads a house.
  const byArea = new Map<string, QuoteLine[]>()
  for (const l of lines) {
    const key = l.area_label ?? 'Other'
    byArea.set(key, [...(byArea.get(key) ?? []), l])
  }

  type Cell = string | { content: string; colSpan?: number; styles?: Record<string, unknown> }
  const body: Cell[][] = []
  for (const [areaName, group] of byArea) {
    body.push([{ content: areaName, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [253, 251, 247] } }])
    for (const l of group) {
      const m = lineMath(l, quote.markup_pct)
      body.push([
        l.description,
        `${l.qty} ${l.unit}`,
        (m.clientAmount / (l.qty || 1)).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
        m.clientAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 }),
      ])
    }
  }

  autoTable(doc, {
    startY: 160,
    head: [['Item', 'Qty', 'Rate', 'Amount']],
    body: body as never,
    margin: { left: M, right: M },
    styles: {
      font: 'helvetica', fontSize: 9, cellPadding: 5,
      textColor: INK, lineColor: [233, 225, 214], lineWidth: 0.5,
    },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      1: { halign: 'right', cellWidth: 70 },
      2: { halign: 'right', cellWidth: 70 },
      3: { halign: 'right', cellWidth: 85, fontStyle: 'bold' },
    },
  })

  const totals = quoteTotals(lines, quote)
  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 400
  let y = lastY + 18

  const rows: [string, string, boolean?][] = [
    ['Subtotal', totals.clientSubtotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })],
  ]
  if (totals.discount) {
    rows.push(['Discount', `- ${totals.discount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`])
  }
  rows.push(['Total payable', `Rs ${totals.clientTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, true])

  for (const [label, value, strong] of rows) {
    doc.setFont('helvetica', strong ? 'bold' : 'normal')
    doc.setFontSize(strong ? 11 : 9)
    doc.setTextColor(...(strong ? INK : SOFT))
    doc.text(label, W - M - 180, y)
    doc.text(value, W - M, y, { align: 'right' })
    y += strong ? 20 : 15
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...SOFT)
  doc.text('All rates are inclusive of GST. Material supplied by Material Depot.', M, y + 6)
  if (quote.notes) {
    doc.text(doc.splitTextToSize(quote.notes, W - M * 2), M, y + 20)
  }

  const safe = `${projectName}-quote-v${quote.version}`.replace(/[^a-z0-9-]+/gi, '-')
  doc.save(`${safe}.pdf`)
}
