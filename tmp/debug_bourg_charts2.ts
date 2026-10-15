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
const body = `<script id="mauna-echarts">${loadEchartsMinJs()}</script>`
if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, `${body}</head>`)

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } })
await page.emulateMedia({ media: 'print' })
await page.setContent(html, { waitUntil: 'load', timeout: 45000 })
await new Promise((r) => setTimeout(r, 2000))
const info = await page.evaluate(() => {
  const scripts = Array.from(document.querySelectorAll('script')).map((s) => s.textContent || '')
  const boot = scripts.find((s) => s.includes('const charts =') && s.includes('seriesHasData'))
  if (!boot) return { err: 'no boot script' }
  // re-parse charts from script text
  const m = boot.match(/const charts = (\[[\s\S]*?\]);\n  const palette/)
  if (!m) return { err: 'no charts match', sample: boot.slice(0, 120) }
  const charts = JSON.parse(m[1])
  const seriesHasData = (option: any) => {
    if (!option || typeof option !== 'object') return false
    const series = Array.isArray(option.series) ? option.series : option.series ? [option.series] : []
    for (const s of series) {
      if (!s || typeof s !== 'object') continue
      const data = s.data
      if (!Array.isArray(data) || data.length === 0) continue
      if (data.some((p: any) => typeof p === 'number' && Number.isFinite(p))) return true
      if (data.some((p: any) => Array.isArray(p) && p.some((v) => typeof v === 'number' && Number.isFinite(v))))
        return true
      if (data.some((p: any) => p && typeof p === 'object' && typeof p.value === 'number' && Number.isFinite(p.value)))
        return true
    }
    const source = option.dataset && option.dataset.source
    return Array.isArray(source) && source.length > 1
  }
  const first = charts[0]
  const el = document.getElementById(first.id)
  let initErr: string | null = null
  let setErr: string | null = null
  let ready = false
  try {
    const inst = (window as any).echarts.init(el, null, { renderer: 'canvas' })
    try {
      inst.setOption({ ...first.option, animation: false }, true)
      ready = true
    } catch (e: any) {
      setErr = String(e?.message || e)
    }
  } catch (e: any) {
    initErr = String(e?.message || e)
  }
  return {
    n: charts.length,
    hasData: charts.map((c: any) => seriesHasData(c.option)).filter(Boolean).length,
    firstHasData: seriesHasData(first.option),
    el: Boolean(el),
    initErr,
    setErr,
    ready,
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
