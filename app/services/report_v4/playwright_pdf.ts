import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import logger from '@adonisjs/core/services/logger'
import { chromium, type Page, type Route } from 'playwright'
import {
  extractArtifactBootChartIds,
  pruneOrphanChartHostsInHtml,
} from '#services/report_v4/artifact_html'
import { stampMaunaWatermarkOnPdf } from '#services/report_v4/mauna_watermark'
import {
  loadEchartsMinJs,
  REPORT_V4_ECHARTS_ASSET_PATH,
} from '#services/report_v4/report_v4_assets'
import { REPORT_V4_PDF_ALLOWED_HOST_SUFFIXES } from '#services/report_v4/report_v4_constants'

const A4_VIEWPORT = { width: 794, height: 1123 }
const PDF_TIMEOUT_MS = 45_000
const CHARTS_READY_MS = 5_000
const CHARTS_READY_PER_BOX_MS = 400
const ALLOWED_FETCH_MS = 8_000

const inlineEchartsForPdf = (html: string): string => {
  const tag = /<script\b[^>]*id=["']mauna-echarts["'][^>]*>[\s\S]*?<\/script>/i
  const body = `<script id="mauna-echarts">${loadEchartsMinJs()}</script>`
  if (tag.test(html)) return html.replace(tag, body)
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${body}</head>`)
  return `${body}\n${html}`
}

const PDF_CONTRAST_OVERRIDE_CSS = `
.card, .chart-card { color: var(--ink, #0f172a) !important; }
.card p, .chart-card p { color: var(--ink-soft, #334155) !important; }
.kpi, .kpi-value { color: var(--ink, #0f172a) !important; }
.kpi-label { color: var(--muted, #64748b) !important; }
.band:has(.card), .band:has(.chart-card), .band:has(.kpi), .band:has(.kpi-grid), .band:has(.chart-box) {
  display: block !important; background: transparent !important; color: var(--ink, #0f172a) !important;
  padding: 0 !important; gap: 0 !important;
}
.band:has(.card) > .band-title, .band:has(.kpi-grid) > .band-title {
  display: flex !important; background: var(--band, #0b1f3a) !important; color: #fff !important;
  border-radius: 6px; padding: 9px 12px; margin: 0 0 8px;
}
`.trim()

const injectPdfContrastOverrides = (html: string): string => {
  const sheet = `<style id="mauna-pdf-contrast">${PDF_CONTRAST_OVERRIDE_CSS}</style>`
  if (/id=["']mauna-pdf-contrast["']/i.test(html)) {
    return html.replace(/<style\b[^>]*id=["']mauna-pdf-contrast["'][^>]*>[\s\S]*?<\/style>/i, sheet)
  }
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${sheet}</head>`)
  return `${sheet}\n${html}`
}

export const stripExternalPdfAssetHosts = (html: string): string => {
  let next = html
  next = next.replace(/<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>/gi, '')
  next = next.replace(/@import\s+(?:url\()?['"]?https?:\/\/fonts\.googleapis\.com[^;]+;?/gi, '')
  next = next.replace(/<script\b[^>]*cdn\.jsdelivr\.net[^>]*>[\s\S]*?<\/script>/gi, '')
  return next
}

const sanitizeHtmlForPdfCharts = (html: string): string => {
  const withEcharts = injectPdfContrastOverrides(
    inlineEchartsForPdf(stripExternalPdfAssetHosts(html))
  )
  const bootIds = extractArtifactBootChartIds(withEcharts)
  if (bootIds.length === 0) return withEcharts
  return pruneOrphanChartHostsInHtml(
    withEcharts,
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

type HtmlPdfResult = {
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

const isLocalEchartsAssetUrl = (url: string): boolean => {
  try {
    const path = new URL(url).pathname
    return (
      path === REPORT_V4_ECHARTS_ASSET_PATH || path.endsWith('/report-v4/assets/echarts.min.js')
    )
  } catch {
    return url.includes('report-v4/assets/echarts.min.js')
  }
}

const installOfflineNetworkGuard = async (page: Page): Promise<void> => {
  await page.route('**/*', async (route: Route) => {
    const request = route.request()
    const url = request.url()

    if (isLocalEchartsAssetUrl(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: loadEchartsMinJs(),
      })
      return
    }

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
      const response = await route.fetch({ timeout: ALLOWED_FETCH_MS })
      await route.fulfill({ response })
    } catch {
      await route.abort('timedout')
    }
  })
}

const waitChartsOrContinue = async (
  page: Page,
  timeoutMs: number
): Promise<{ chartsReady: boolean; boxesReady: boolean; chartBoxes: number }> => {
  try {
    await page.waitForFunction(
      () => {
        if (document.documentElement.dataset.chartsReady !== '1') return false
        const boxes = Array.from(document.querySelectorAll('.chart-box'))
        if (boxes.length === 0) return true
        return boxes.every((el) => (el as HTMLElement).dataset.ready === '1')
      },
      undefined,
      { timeout: timeoutMs }
    )
    const chartBoxes = await page.locator('.chart-box').count()
    return { chartsReady: true, boxesReady: true, chartBoxes }
  } catch {
    const chartBoxes = await page.locator('.chart-box').count()
    const chartsReady = await page.evaluate(
      () => document.documentElement.dataset.chartsReady === '1'
    )
    const boxesReady =
      chartBoxes === 0
        ? chartsReady
        : await page.evaluate(() =>
            Array.from(document.querySelectorAll('.chart-box')).every(
              (el) => (el as HTMLElement).dataset.ready === '1'
            )
          )
    return { chartsReady, boxesReady, chartBoxes }
  }
}

const forcePaintChartsFromBootPayload = async (page: Page): Promise<number> =>
  page.evaluate(() => {
    const echarts = (window as unknown as { echarts?: any }).echarts
    if (!echarts) return 0
    const bootScript = Array.from(document.querySelectorAll('script')).find((script) =>
      (script.textContent || '').includes('const charts =')
    )
    const text = bootScript?.textContent || ''
    const match = text.match(/const charts = (\[[\s\S]*?\]);\n\s*const palette/)
    if (!match?.[1]) return 0
    let charts: Array<{ id: string; option?: Record<string, unknown> }> = []
    try {
      charts = JSON.parse(match[1]) as Array<{ id: string; option?: Record<string, unknown> }>
    } catch {
      return 0
    }
    let painted = 0
    for (const chart of charts) {
      const el = document.getElementById(chart.id) as HTMLElement | null
      if (!el || !chart.option) continue
      if (el.dataset.ready === '1') {
        painted += 1
        continue
      }
      el.classList.add('chart-box')
      el.style.width = el.clientWidth > 0 ? '100%' : '770px'
      el.style.height = el.style.height || '260px'
      try {
        const prior = echarts.getInstanceByDom?.(el)
        if (prior) prior.dispose()
        const instance = echarts.init(el, null, {
          renderer: 'canvas',
          width: el.clientWidth || 770,
          height: el.clientHeight || 260,
        })
        instance.setOption({ ...chart.option, animation: false }, true)
        el.dataset.ready = '1'
        painted += 1
      } catch {
        // keep trying remaining charts
      }
    }
    document.documentElement.dataset.chartsReady = '1'
    return painted
  })

const loadHtmlAndWaitCharts = async (
  page: Page,
  html: string
): Promise<{ chartsReady: boolean; boxesReady: boolean; chartBoxes: number }> => {
  await page.setContent(html, { waitUntil: 'load', timeout: PDF_TIMEOUT_MS })
  const boxCount = await page.locator('.chart-box').count()
  const timeoutMs = Math.min(
    PDF_TIMEOUT_MS,
    Math.max(CHARTS_READY_MS, boxCount * CHARTS_READY_PER_BOX_MS)
  )
  let ready = await waitChartsOrContinue(page, timeoutMs)
  const readyBoxes = await page.locator('.chart-box[data-ready="1"]').count()
  if (ready.chartBoxes > 0 && readyBoxes < ready.chartBoxes) {
    const painted = await forcePaintChartsFromBootPayload(page)
    logger.info(
      { painted, chartBoxes: ready.chartBoxes, readyBefore: readyBoxes },
      'report_v4.pdf_force_paint_charts'
    )
    ready = await waitChartsOrContinue(page, Math.min(8_000, timeoutMs))
  }
  return ready
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
      viewport: A4_VIEWPORT,
      deviceScaleFactor: 2,
    })
    page.setDefaultTimeout(PDF_TIMEOUT_MS)
    page.setDefaultNavigationTimeout(PDF_TIMEOUT_MS)
    await page.emulateMedia({ media: 'print' })
    await installOfflineNetworkGuard(page)

    const ready = await loadHtmlAndWaitCharts(page, html)
    const expectedBoxes = ready.chartBoxes
    const readyBoxes = await page.locator('.chart-box[data-ready="1"]').count()
    if (
      expectedBoxes > 0 &&
      (!ready.chartsReady || !ready.boxesReady || readyBoxes !== expectedBoxes)
    ) {
      logger.error(
        {
          expectedBoxes,
          readyBoxes,
          chartsReady: ready.chartsReady,
          boxesReady: ready.boxesReady,
        },
        'report_v4.pdf_charts_count_mismatch'
      )
      throw new ChartsNotReadyError({
        chartBoxes: expectedBoxes,
        chartsReady: ready.chartsReady,
        boxesReady: readyBoxes === expectedBoxes && ready.boxesReady,
      })
    }

    if (readyBoxes > 0) {
      await page.evaluate(() => {
        document.querySelectorAll<HTMLElement>('.chart-box').forEach((el) => {
          if (el.dataset.ready !== '1') return
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
