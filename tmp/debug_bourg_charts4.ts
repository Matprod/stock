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
let html = await readFile('tmp/canari_runs/bourg_fix_classic.html', 'utf8')
html = stripExternalPdfAssetHosts(html)
const tag = /<script\b[^>]*id=["']mauna-echarts["'][^>]*>[\s\S]*?<\/script>/i
const body = `<script id="mauna-echarts">${loadEchartsMinJs()}</script>`
html = tag.test(html) ? html.replace(tag, body) : html.replace(/<\/head>/i, `${body}</head>`)

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } })
page.on('pageerror', (err) => console.error('PAGEERROR', err.message.slice(0, 400)))
await page.emulateMedia({ media: 'print' })
await page.setContent(html, { waitUntil: 'load', timeout: 45000 })
await new Promise((r) => setTimeout(r, 2500))
const info = await page.evaluate(() => {
  const boxes = Array.from(document.querySelectorAll('.chart-box'))
  const before = {
    chartsReady: document.documentElement.dataset.chartsReady,
    ready: boxes.filter((el) => (el as HTMLElement).dataset.ready === '1').length,
  }
  // force re-boot by finding charts from script
  const bootScript = Array.from(document.querySelectorAll('script')).find((s) =>
    (s.textContent || '').includes('const charts =')
  )
  const text = bootScript?.textContent || ''
  const m = text.match(/const charts = (\[[\s\S]*?\]);\n  const palette/)
  const charts = m ? JSON.parse(m[1]) : []
  let painted = 0
  let errors: string[] = []
  for (const chart of charts) {
    const el = document.getElementById(chart.id)
    if (!el) {
      errors.push('noel:' + chart.id)
      continue
    }
    try {
      const inst = (window as any).echarts.init(el, null, { renderer: 'canvas' })
      inst.setOption({ ...chart.option, animation: false }, true)
      ;(el as HTMLElement).dataset.ready = '1'
      painted += 1
    } catch (e: any) {
      errors.push(String(e?.message || e).slice(0, 80))
    }
  }
  return {
    before,
    painted,
    errors: errors.slice(0, 5),
    afterReady: Array.from(document.querySelectorAll('.chart-box')).filter(
      (el) => (el as HTMLElement).dataset.ready === '1'
    ).length,
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
