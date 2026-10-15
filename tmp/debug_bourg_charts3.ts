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

const playwrightPdf = await import('#services/report_v4/playwright_pdf')
const { loadEchartsMinJs } = await import('#services/report_v4/report_v4_assets')
const { extractArtifactBootChartIds, pruneOrphanChartHostsInHtml } = await import(
  '#services/report_v4/artifact_html'
)

let html = await readFile('tmp/canari_runs/bourg_fix_classic.html', 'utf8')
html = playwrightPdf.stripExternalPdfAssetHosts(html)
const body = `<script id="mauna-echarts">${loadEchartsMinJs()}</script>`
if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, `${body}</head>`)
const bootIds = extractArtifactBootChartIds(html)
console.log('bootIds', bootIds.length)
const pruned = pruneOrphanChartHostsInHtml(
  html,
  bootIds.map((id) => ({ id }))
)
console.log('pruned', pruned.pruned)
html = pruned.html

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } })
page.on('pageerror', (err) => console.error('PAGEERROR', err.message.slice(0, 300)))
await page.emulateMedia({ media: 'print' })
await page.setContent(html, { waitUntil: 'load', timeout: 45000 })
await new Promise((r) => setTimeout(r, 2500))
const info = await page.evaluate(() => {
  const boxes = Array.from(document.querySelectorAll('.chart-box'))
  return {
    chartsReady: document.documentElement.dataset.chartsReady,
    boxes: boxes.length,
    ready: boxes.filter((el) => (el as HTMLElement).dataset.ready === '1').length,
  }
})
console.log(JSON.stringify(info))
await browser.close()
