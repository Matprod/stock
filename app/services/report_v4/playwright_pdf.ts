import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Page, type Route } from 'playwright'
import {
  extractArtifactBootChartIds,
  pruneOrphanChartHostsInHtml,
} from '#services/report_v4/artifact_html'
import { stampMaunaWatermarkOnPdf } from '#services/report_v4/mauna_watermark'
import {
  REPORT_V4_A4_VIEWPORT,
  REPORT_V4_ALLOWED_FETCH_MS,
  REPORT_V4_CHARTS_READY_MS,
  REPORT_V4_PDF_ALLOWED_HOST_SUFFIXES,
  REPORT_V4_PDF_TIMEOUT_MS,
} from '#services/report_v4/report_v4_constants'

const sanitizeHtmlForPdfCharts = (html: string): string => {
  const bootIds = extractArtifactBootChartIds(html)
  if (bootIds.length === 0) return html
  return pruneOrphanChartHostsInHtml(
    html,
    bootIds.map((id) => ({ id }))
  ).html
}

export class ChartsNotReadyError extends Error {
  readonly chartBoxes: number
  readonly chartsReady: boolean
  readonly boxesReady: boolean

  constructor(args: { chartBoxes: number; chartsReady: boolean; boxesReady: boolean }) {
    super(
      `PDF charts not ready (boxes=${args.chartBoxes}, chartsReady=${args.chartsReady}, boxesReady=${args.boxesReady})`
    )
    this.name = 'ChartsNotReadyError'
    this.chartBoxes = args.chartBoxes
    this.chartsReady = args.chartsReady
    this.boxesReady = args.boxesReady
  }
}

export type HtmlPdfResult = {
  buffer: Buffer
  filename: string
  htmlPath?: string
  chartsReady: boolean
  boxesReady: boolean
  chartBoxes: number
}

const isAllowedNetworkUrl = (raw: string): boolean => {
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return REPORT_V4_PDF_ALLOWED_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    )
  } catch {
    return false
  }
}

const installOfflineNetworkGuard = async (page: Page): Promise<void> => {
  await page.route('**/*', async (route: Route) => {
    const request = route.request()
    const url = request.url()

    if (
      request.resourceType() === 'document' ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url.startsWith('about:')
    ) {
      await route.continue()
      return
    }

    if (!isAllowedNetworkUrl(url)) {
      await route.abort('blockedbyclient')
      return
    }

    try {
      const response = await route.fetch({ timeout: REPORT_V4_ALLOWED_FETCH_MS })
      await route.fulfill({ response })
    } catch {
      await route.abort('timedout')
    }
  })
}

const waitChartsOrContinue = async (
  page: Page
): Promise<{ chartsReady: boolean; boxesReady: boolean; chartBoxes: number }> => {
  let chartsReady = false
  let boxesReady = false
  try {
    await page.waitForFunction(
      () => document.documentElement.dataset.chartsReady === '1',
      undefined,
      { timeout: REPORT_V4_CHARTS_READY_MS }
    )
    chartsReady = true
  } catch {
    const chartBoxes = await page.locator('.chart-box').count()
    return { chartsReady: false, boxesReady: false, chartBoxes }
  }

  const chartBoxes = await page.locator('.chart-box').count()
  if (chartBoxes === 0) return { chartsReady: true, boxesReady: true, chartBoxes: 0 }

  try {
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('.chart-box')).every(
          (el) => (el as HTMLElement).dataset.ready === '1'
        ),
      undefined,
      { timeout: REPORT_V4_CHARTS_READY_MS }
    )
    boxesReady = true
  } catch {
    boxesReady = false
  }
  return { chartsReady, boxesReady, chartBoxes }
}

const loadHtmlAndWaitCharts = async (
  page: Page,
  html: string
): Promise<{ chartsReady: boolean; boxesReady: boolean; chartBoxes: number }> => {
  await page.setContent(html, { waitUntil: 'load', timeout: REPORT_V4_PDF_TIMEOUT_MS })
  return waitChartsOrContinue(page)
}

export const renderHtmlToPdf = async (args: {
  html: string
  filename: string
  saveHtmlDraft?: boolean
}): Promise<HtmlPdfResult> => {
  const html = sanitizeHtmlForPdfCharts(args.html)
  const draftsDir = join(process.cwd(), 'tmp', 'reports_drafts')
  let htmlPath: string | undefined
  if (args.saveHtmlDraft !== false) {
    await mkdir(draftsDir, { recursive: true })
    htmlPath = join(draftsDir, args.filename.replace(/\.pdf$/i, '.html'))
    await writeFile(htmlPath, html, 'utf8')
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const page = await browser.newPage({
      viewport: REPORT_V4_A4_VIEWPORT,
      deviceScaleFactor: 2,
    })
    page.setDefaultTimeout(REPORT_V4_PDF_TIMEOUT_MS)
    page.setDefaultNavigationTimeout(REPORT_V4_PDF_TIMEOUT_MS)
    await page.emulateMedia({ media: 'print' })
    await installOfflineNetworkGuard(page)

    let ready = await loadHtmlAndWaitCharts(page, html)
    const chartsIncomplete = (row: typeof ready): boolean =>
      row.chartBoxes > 0 && (!row.chartsReady || !row.boxesReady)
    if (chartsIncomplete(ready)) {
      ready = await loadHtmlAndWaitCharts(page, html)
    }
    if (chartsIncomplete(ready)) {
      throw new ChartsNotReadyError({
        chartBoxes: ready.chartBoxes,
        chartsReady: ready.chartsReady,
        boxesReady: ready.boxesReady,
      })
    }

    if (ready.chartBoxes > 0 && ready.boxesReady) {
      await page.evaluate(() => {
        document.querySelectorAll<HTMLElement>('.chart-box').forEach((el) => {
          const isLine = el.classList.contains('line-chart') || el.dataset.chartKind === 'line'
          const isBar = el.classList.contains('bar-rank') || el.dataset.chartKind === 'bar'
          el.style.width = '100%'
          el.style.maxWidth = '100%'
          let height = '260px'
          if (isLine) height = '340px'
          else if (isBar) height = '300px'
          el.style.height = height
          el.style.boxSizing = 'border-box'
        })
        document.querySelectorAll<HTMLElement>('.chart-card, article.chart-card').forEach((el) => {
          el.style.maxWidth = '100%'
          el.style.boxSizing = 'border-box'
          el.style.overflow = 'hidden'
        })
        const resize = (window as unknown as { __maunaResizeCharts?: () => void })
          .__maunaResizeCharts
        if (typeof resize === 'function') resize()
      })
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
      outline: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    const pdfBuffer = await stampMaunaWatermarkOnPdf(Buffer.from(buffer))
    if (htmlPath) {
      await writeFile(htmlPath.replace(/\.html$/i, '.pdf'), pdfBuffer)
    }

    return {
      buffer: pdfBuffer,
      filename: args.filename,
      chartsReady: ready.chartsReady,
      boxesReady: ready.boxesReady,
      chartBoxes: ready.chartBoxes,
      ...(htmlPath ? { htmlPath } : {}),
    }
  } finally {
    await browser.close()
  }
}

export const slugFilename = (title: string, from: string, to: string): string => {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `${slug || 'report-v4-report'}-${from}_${to}.pdf`
}
