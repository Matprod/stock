import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const APP_ROOT = new URL('../', import.meta.url)
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}
const ignitor = new Ignitor(APP_ROOT, { importer: IMPORTER })
const app = ignitor.createApp('console')
await app.init()
await app.boot()

const { stripExternalPdfAssetHosts } = await import('#services/report_v4/playwright_pdf')
const { loadEchartsMinJs } = await import('#services/report_v4/report_v4_assets')
const { extractArtifactBootChartIds, pruneOrphanChartHostsInHtml } = await import(
  '#services/report_v4/artifact_html'
)

let html = await readFile(
  'tmp/reports_drafts/fait-moi-un-rapport-sur-la-semaine-derniere-fait-2026-10-05_2026-10-11.html',
  'utf8'
)
html = stripExternalPdfAssetHosts(html)
const tag = /<script\b[^>]*id=["']mauna-echarts["'][^>]*>[\s\S]*?<\/script>/i
const body = `<script id="mauna-echarts">${loadEchartsMinJs()}</script>`
html = tag.test(html) ? html.replace(tag, body) : html.replace(/<\/head>/i, `${body}</head>`)
const bootIds = extractArtifactBootChartIds(html)
html = pruneOrphanChartHostsInHtml(
  html,
  bootIds.map((id) => ({ id }))
).html

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 })
const pageErrors: string[] = []
page.on('pageerror', (err) => pageErrors.push(err.message))
await page.emulateMedia({ media: 'print' })
await page.setContent(html, { waitUntil: 'load', timeout: 45000 })
await new Promise((r) => setTimeout(r, 3000))
const info = await page.evaluate(() => {
  const boxes = Array.from(document.querySelectorAll('.chart-box')) as HTMLElement[]
  const bootScript = Array.from(document.querySelectorAll('script')).find((s) =>
    (s.textContent || '').includes('const charts =')
  )
  const text = bootScript?.textContent || ''
  const m = text.match(/const charts = (\[[\s\S]*?\]);\n  const palette/)
  const charts = m ? JSON.parse(m[1]) : []
  // simulate boot steps for first chart
  const chart = charts[0]
  const el = document.getElementById(chart.id) as HTMLElement | null
  let step = 'start'
  let err: string | null = null
  try {
    step = 'init'
    const instance = (window as any).echarts.init(el, null, { renderer: 'canvas' })
    step = 'build-option'
    const baseLegend =
      chart.option && chart.option.legend && typeof chart.option.legend === 'object'
        ? chart.option.legend
        : {}
    const hasVisualMap = Boolean(chart.option && chart.option.visualMap)
    let option: any = {
      animation: false,
      backgroundColor: '#ffffff',
      ...chart.option,
      legend: hasVisualMap
        ? { show: false, ...(baseLegend && baseLegend.show === true ? baseLegend : {}) }
        : { icon: 'roundRect', ...baseLegend, type: 'plain' },
    }
    if (option.maunaLayout != null) delete option.maunaLayout
    step = 'series-map'
    // run series map-like access
    if (Array.isArray(option.series)) {
      option.series = option.series.map((s: any) => {
        if (!s || typeof s !== 'object') return s
        return s
      })
    }
    step = 'setOption'
    instance.setOption(option, true)
    step = 'done'
  } catch (e: any) {
    err = `${step}: ${e?.message || e}`
  }
  return {
    chartsReady: document.documentElement.dataset.chartsReady,
    boxes: boxes.length,
    ready: boxes.filter((el) => el.dataset.ready === '1').length,
    chartsN: charts.length,
    firstId: chart?.id,
    err,
  }
})
console.log(JSON.stringify({ info, pageErrors }, null, 2))
await browser.close()
