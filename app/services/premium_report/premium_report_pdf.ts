import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DateTime } from 'luxon'
import PDFDocument from 'pdfkit'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumReportBlock, PremiumReportDocument } from '#contracts/premium_report'
import type { ReportPdfFile } from '#services/report_builder/pdf/pdf_renderer'
import { getPdfCopy } from '#services/report_builder/pdf/pdf_copy'
import { renderEchartsPng } from '#services/premium_report/echarts_render'
import {
  resolveHeatColors,
  resolveTableBorder,
  resolveTableCellStyle,
  resolveTableHeaderStyle,
} from '#services/premium_report/premium_report_document'
import type { AppLanguage } from '#utils/localize'
import {
  contentBottom,
  contentLeft,
  contentWidth,
  fitPdfText,
  PDF_THEME,
} from '#services/report_builder/pdf/pdf_theme'

const PDF_CHART_SCALE = 2
const PDF_CHART_PNG_WIDTH = Math.round(contentWidth() * PDF_CHART_SCALE)
const PDF_CHART_PNG_HEIGHT = Math.round(PDF_THEME.cartesianHeight * PDF_CHART_SCALE)

type PdfSession = {
  doc: PDFKit.PDFDocument
  language: AppLanguage
  clubName: string
  brand: string
  confidential: string
  generatedAt: DateTime
  y: number
}

const WATERMARK_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../report_builder/pdf/rapport-watermark-a4.png'
)

export const buildPremiumReportPdf = async (args: {
  document: PremiumReportDocument
  clubName: string
  language: AppLanguage
}): Promise<ReportPdfFile> => {
  const { document, clubName, language } = args
  const copy = getPdfCopy(language)
  const generatedAt = DateTime.now().setLocale(language)
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: true,
    bufferPages: true,
  })
  const bufferPromise = toBuffer(doc)
  const session: PdfSession = {
    doc,
    language,
    clubName,
    brand: copy.brand,
    confidential: copy.confidential,
    generatedAt,
    y: PDF_THEME.headerHeight + 18,
  }

  drawWatermark(doc)
  drawHeader(session)
  drawTitle(session, document, copy.untitled, copy.dateRange(document.dateRange))

  for (const block of document.blocks) {
    await drawBlock(session, block, copy.noData)
  }

  const range = doc.bufferedPageRange()
  for (let index = 0; index < range.count; index++) {
    doc.switchToPage(range.start + index)
    drawFooter(session, copy.generatedAt(generatedAt), copy.page(index + 1, range.count))
  }
  doc.end()

  const slug = slugify(document.title || copy.untitled)
  const filename = `${slug}-${document.dateRange.from}_${document.dateRange.to}.pdf`
  return { buffer: await bufferPromise, filename }
}

const drawBlock = async (
  session: PdfSession,
  block: PremiumReportBlock,
  noData: string
): Promise<void> => {
  if (block.type === PREMIUM_BLOCK_TYPE.HEADING) {
    const size = block.level === 2 ? 11 : 13
    drawWrappedTitle(session, toPdfSafeText(block.text), size, true)
    return
  }

  if (block.type === PREMIUM_BLOCK_TYPE.TEXT) {
    drawWrappedText(session, block.text)
    return
  }

  if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
    drawTable(session, block.title, block.columns, block.rows, noData, block.option)
    return
  }

  const chartHeight = PDF_THEME.cartesianHeight
  ensureSpace(session, (block.title.trim() ? 40 : 0) + chartHeight + 16)
  if (block.title.trim()) {
    drawWrappedTitle(session, toPdfSafeText(block.title), 9, true)
  }
  try {
    const png = await renderEchartsPng(block.option, PDF_CHART_PNG_WIDTH, PDF_CHART_PNG_HEIGHT)
    session.doc.image(png, contentLeft(), session.y, {
      width: contentWidth(),
      height: chartHeight,
    })
  } catch {
    session.doc
      .rect(contentLeft(), session.y, contentWidth(), chartHeight)
      .strokeColor(PDF_THEME.line)
      .stroke()
    session.doc.font('Helvetica').fontSize(9).fillColor(PDF_THEME.muted)
    session.doc.text(noData, contentLeft() + 12, session.y + chartHeight / 2 - 6, {
      lineBreak: false,
    })
  }
  session.y += chartHeight + 16
}

const drawTable = (
  session: PdfSession,
  title: string | undefined,
  columns: string[],
  rows: Array<Array<string | number | null>>,
  noData: string,
  option?: Record<string, unknown>
) => {
  if (title?.trim()) {
    drawWrappedTitle(session, toPdfSafeText(title), 9, true)
  }
  if (columns.length === 0) return
  const colWidth = contentWidth() / columns.length
  const rowHeight = 16
  const headerStyle = resolveTableHeaderStyle(option)
  const border = resolveTableBorder(option)
  ensureSpace(session, rowHeight)
  columns.forEach((column, index) => {
    const x = contentLeft() + index * colWidth
    session.doc
      .rect(x, session.y, colWidth, rowHeight)
      .fillColor(headerStyle.background ?? PDF_THEME.card)
      .fill()
    if (border) {
      session.doc
        .rect(x, session.y, colWidth, rowHeight)
        .strokeColor(border.color)
        .lineWidth(border.width)
        .stroke()
    }
    session.doc
      .font(headerStyle.bold === false ? 'Helvetica' : 'Helvetica-Bold')
      .fontSize(7)
      .fillColor(headerStyle.color ?? PDF_THEME.muted)
    session.doc.text(
      fitPdfText(session.doc, toPdfSafeText(column), colWidth - 8),
      x + 4,
      session.y + 4,
      { lineBreak: false, align: headerStyle.align, width: colWidth - 8 }
    )
  })
  session.y += rowHeight

  const body = rows.length > 0 ? rows : [columns.map(() => noData)]
  for (const [rowIndex, row] of body.entries()) {
    ensureSpace(session, rowHeight)
    columns.forEach((column, index) => {
      const cell = row[index]
      const style = resolveTableCellStyle({
        column,
        rowIndex,
        colIndex: index,
        option,
      })
      const x = contentLeft() + index * colWidth
      if (style.background) {
        session.doc.rect(x, session.y, colWidth, rowHeight).fillColor(style.background).fill()
      }
      if (border) {
        session.doc
          .rect(x, session.y, colWidth, rowHeight)
          .strokeColor(border.color)
          .lineWidth(border.width)
          .stroke()
      }
      const label = cell === null || cell === undefined ? '' : toPdfSafeText(String(cell))
      session.doc
        .font(style.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(7)
        .fillColor(style.color ?? PDF_THEME.text)
      session.doc.text(fitPdfText(session.doc, label, colWidth - 8), x + 4, session.y + 4, {
        lineBreak: false,
        align: style.align,
        width: colWidth - 8,
      })
    })
    if (!border) {
      session.doc
        .moveTo(contentLeft(), session.y + rowHeight)
        .lineTo(contentLeft() + contentWidth(), session.y + rowHeight)
        .strokeColor(PDF_THEME.line)
        .lineWidth(0.4)
        .stroke()
    }
    session.y += rowHeight
  }
  drawHeatLegend(session, option)
  session.y += 12
}

const drawHeatLegend = (session: PdfSession, option?: Record<string, unknown>) => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return
  const legend = option.heatLegend
  if (!legend || typeof legend !== 'object' || Array.isArray(legend)) return

  const colors = resolveHeatColors(option)
  const hasRisk = 'hasRisk' in legend && legend.hasRisk === true
  const fr = session.language === 'fr'

  const intro = fr
    ? 'Légende des couleurs (comparaison dans cette table uniquement) :'
    : 'Color legend (comparison within this table only):'
  const items = fr
    ? [
        { color: colors.volumeMid, label: 'Élevé' },
        { color: colors.volumeHigh, label: 'Très élevé' },
        ...(hasRisk
          ? [
              { color: colors.riskMid, label: 'Risque' },
              { color: colors.riskHigh, label: 'Risque fort' },
            ]
          : []),
      ]
    : [
        { color: colors.volumeMid, label: 'High' },
        { color: colors.volumeHigh, label: 'Very high' },
        ...(hasRisk
          ? [
              { color: colors.riskMid, label: 'Risk' },
              { color: colors.riskHigh, label: 'High risk' },
            ]
          : []),
      ]

  ensureSpace(session, 28)
  session.doc.font('Helvetica').fontSize(7).fillColor(PDF_THEME.muted)
  session.doc.text(intro, contentLeft(), session.y, { lineBreak: false })
  session.y += 11

  let x = contentLeft()
  const swatch = 9
  const gap = 14
  for (const item of items) {
    session.doc.rect(x, session.y, swatch, swatch).fillColor(item.color).fill()
    session.doc.rect(x, session.y, swatch, swatch).strokeColor('#9CA3AF').lineWidth(0.6).stroke()
    session.doc.font('Helvetica').fontSize(7).fillColor(PDF_THEME.muted)
    const labelWidth = session.doc.widthOfString(item.label)
    session.doc.text(item.label, x + swatch + 4, session.y + 1, { lineBreak: false })
    x += swatch + 4 + labelWidth + gap
  }
  session.y += 14
}

const drawWrappedTitle = (
  session: PdfSession,
  raw: string,
  fontSize: number,
  bold: boolean
): void => {
  const text = toPdfSafeText(raw).trim()
  if (!text) return
  const width = contentWidth()
  const lineHeight = fontSize + 3
  session.doc
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(fontSize)
    .fillColor(bold && fontSize >= 11 ? PDF_THEME.navy : PDF_THEME.text)
  let current = ''
  const flush = () => {
    if (!current) return
    ensureSpace(session, lineHeight)
    session.doc.text(current, contentLeft(), session.y, { lineBreak: false, width })
    session.y += lineHeight
    current = ''
  }
  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word
    if (session.doc.widthOfString(next) <= width) {
      current = next
      continue
    }
    flush()
    current = word
  }
  flush()
  session.y += 4
}

const drawWrappedText = (session: PdfSession, raw: string) => {
  const text = toPdfSafeText(raw)
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\r\n/g, '\n')
    .trim()
  if (!text) return
  const width = contentWidth()
  session.doc.font('Helvetica').fontSize(9).fillColor(PDF_THEME.text)
  const lineHeight = 12
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) {
      session.y += 6
      continue
    }
    let current = ''
    for (const word of paragraph.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word
      if (session.doc.widthOfString(next) <= width) {
        current = next
        continue
      }
      ensureSpace(session, lineHeight)
      session.doc.text(current, contentLeft(), session.y, { lineBreak: false })
      session.y += lineHeight
      current = word
    }
    if (current) {
      ensureSpace(session, lineHeight)
      session.doc.text(current, contentLeft(), session.y, { lineBreak: false })
      session.y += lineHeight
    }
  }
  session.y += 10
}

const drawTitle = (
  session: PdfSession,
  document: PremiumReportDocument,
  untitled: string,
  rangeLabel: string
) => {
  const title = toPdfSafeText(document.title.trim() || untitled)
  session.doc.font('Helvetica-Bold').fontSize(18).fillColor(PDF_THEME.text)
  session.doc.text(fitPdfText(session.doc, title, contentWidth()), contentLeft(), session.y, {
    lineBreak: false,
  })
  session.y += 24
  session.doc.font('Helvetica').fontSize(10).fillColor(PDF_THEME.muted)
  session.doc.text(rangeLabel, contentLeft(), session.y, { lineBreak: false })
  session.y += 18
  session.doc
    .moveTo(contentLeft(), session.y)
    .lineTo(contentLeft() + contentWidth(), session.y)
    .strokeColor(PDF_THEME.line)
    .lineWidth(0.8)
    .stroke()
  session.y += PDF_THEME.titleGap
}

const drawWatermark = (doc: PDFKit.PDFDocument) => {
  doc.save()
  doc.image(WATERMARK_PATH, 0, 0, {
    width: PDF_THEME.pageWidth,
    height: PDF_THEME.pageHeight,
  })
  doc.restore()
}

const drawHeader = (session: PdfSession) => {
  const { doc, clubName, brand, confidential } = session
  doc.rect(0, 0, PDF_THEME.pageWidth, PDF_THEME.headerHeight).fillColor(PDF_THEME.navy).fill()
  doc
    .rect(0, PDF_THEME.headerHeight - 3, PDF_THEME.pageWidth, 3)
    .fillColor(PDF_THEME.gold)
    .fill()
  doc.font('Helvetica-Bold').fontSize(10).fillColor(PDF_THEME.white)
  const club = fitPdfText(doc, clubName.trim() || brand, 240)
  doc.text(club, PDF_THEME.marginX, 16, { lineBreak: false })
  doc.font('Helvetica').fontSize(8)
  const right = `${brand}  |  ${confidential}`
  const rightWidth = doc.widthOfString(right)
  doc.fillColor('#D6DEE8').text(right, PDF_THEME.pageWidth - PDF_THEME.marginX - rightWidth, 18, {
    lineBreak: false,
  })
}

const drawFooter = (session: PdfSession, generated: string, pageLabel: string) => {
  const { doc } = session
  const y = PDF_THEME.pageHeight - PDF_THEME.footerHeight
  doc
    .moveTo(PDF_THEME.marginX, y)
    .lineTo(PDF_THEME.pageWidth - PDF_THEME.marginX, y)
    .strokeColor(PDF_THEME.line)
    .lineWidth(0.6)
    .stroke()
  doc.font('Helvetica').fontSize(8).fillColor(PDF_THEME.muted)
  doc.text(generated, PDF_THEME.marginX, y + 10, { lineBreak: false })
  const pageWidth = doc.widthOfString(pageLabel)
  doc.text(pageLabel, PDF_THEME.pageWidth - PDF_THEME.marginX - pageWidth, y + 10, {
    lineBreak: false,
  })
}

const addPage = (session: PdfSession) => {
  session.doc.addPage()
  drawWatermark(session.doc)
  drawHeader(session)
  session.y = PDF_THEME.headerHeight + 18
}

const ensureSpace = (session: PdfSession, height: number) => {
  if (session.y + height <= contentBottom()) return
  addPage(session)
}

const slugify = (value: string): string => {
  const slug = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48)
    .toLowerCase()
  return slug || 'report'
}

const toPdfSafeText = (value: string): string =>
  value
    .normalize('NFKC')
    .replace(/\u03c1|\u03a1|\u1d68/g, 'r')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2260/g, '!=')
    .replace(/\u2248|\u223c/g, '~')
    .replace(/\u00d7|\u22c5/g, 'x')
    .replace(/\u2192|\u27f6/g, '->')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A1-\u00FF]/g, '')

const toBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
