import { REPORT_CHART_COLORS } from '#constants/report_builder.constants'

export const PDF_THEME = {
  page: '#FFFFFF',
  navy: '#0B1F3A',
  navyMuted: '#1E3A5F',
  gold: '#C4A35A',
  text: '#1A1A1A',
  muted: '#5C6570',
  line: '#E6E8EC',
  grid: '#EEF0F3',
  card: '#F5F7FA',
  cardBorder: '#E2E6EC',
  white: '#FFFFFF',
  chartColors: REPORT_CHART_COLORS,
  pageWidth: 595.28,
  pageHeight: 841.89,
  marginX: 40,
  headerHeight: 46,
  footerHeight: 36,
  contentBottomInset: 48,
  titleGap: 18,
  blocGap: 16,
  cartesianHeight: 214,
  pieHeight: 176,
  chartTitleHeight: 16,
  kpiCardHeight: 50,
  kpiGap: 8,
} as const

export type PdfRect = {
  x: number
  y: number
  width: number
  height: number
}

export const colorForIndex = (index: number): string =>
  PDF_THEME.chartColors[index % PDF_THEME.chartColors.length]

export const contentWidth = (): number => PDF_THEME.pageWidth - PDF_THEME.marginX * 2

export const contentLeft = (): number => PDF_THEME.marginX

export const contentBottom = (): number => PDF_THEME.pageHeight - PDF_THEME.contentBottomInset

const toPdfSafeText = (text: string): string =>
  [...text.replaceAll('ı', 'i').replaceAll('İ', 'I')]
    .map((char) => {
      const code = char.charCodeAt(0)
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return char
      if ('ŠšŒœŽžŸ€'.includes(char)) return char
      return char.normalize('NFKD').replace(/\p{M}/gu, '')
    })
    .join('')
    .replace(/[^\x20-\x7E\xA0-\xFFŠšŒœŽžŸ€]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const fitPdfText = (doc: PDFKit.PDFDocument, text: string, width: number): string => {
  const safe = toPdfSafeText(text)
  if (width <= 0 || !safe) return ''
  if (doc.widthOfString(safe) <= width) return safe
  let truncated = safe
  while (truncated.length > 1 && doc.widthOfString(`${truncated}...`) > width) {
    truncated = truncated.slice(0, -1)
  }
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace >= Math.floor(truncated.length * 0.45)) {
    truncated = truncated.slice(0, lastSpace)
  }
  return `${truncated.trimEnd()}...`
}
