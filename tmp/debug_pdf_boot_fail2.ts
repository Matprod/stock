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
await page.emulateMedia({ media: 'print' })
await page.setContent(html, { waitUntil: 'load', timeout: 45000 })
await new Promise((r) => setTimeout(r, 2500))

const info = await page.evaluate(() => {
  const bootScript = Array.from(document.querySelectorAll('script')).find((s) =>
    (s.textContent || '').includes('const charts =')
  )
  const text = bootScript?.textContent || ''
  const m = text.match(/const charts = (\[[\s\S]*?\]);\n  const palette/)
  const charts = m ? JSON.parse(m[1]) : []
  const paletteM = text.match(/const palette = (\[[\s\S]*?\]);/)
  const palette = paletteM ? JSON.parse(paletteM[1]) : []
  const injectMissingHosts = /injectMissingHosts = true/.test(text)

  const seriesHasData = (option: any) => {
    if (!option || typeof option !== 'object') return false
    const series = Array.isArray(option.series) ? option.series : option.series ? [option.series] : []
    for (const s of series) {
      if (!s || typeof s !== 'object') continue
      const data = s.data
      if (!Array.isArray(data) || data.length === 0) continue
      if (data.some((p: any) => typeof p === 'number' && Number.isFinite(p))) return true
      if (
        data.some(
          (p: any) => Array.isArray(p) && p.some((v) => typeof v === 'number' && Number.isFinite(v))
        )
      )
        return true
      if (
        data.some(
          (p: any) =>
            p && typeof p === 'object' && typeof p.value === 'number' && Number.isFinite(p.value)
        )
      )
        return true
    }
    const source = option.dataset && option.dataset.source
    return Array.isArray(source) && source.length > 1
  }

  const counts = {
    noData: 0,
    noEl: 0,
    initFail: 0,
    seriesMapFail: 0,
    setFail: 0,
    ok: 0,
  }
  const sampleErrs: string[] = []

  for (const chart of charts) {
    if (!seriesHasData(chart.option)) {
      counts.noData += 1
      continue
    }
    let el = document.getElementById(chart.id)
    if (!el) {
      counts.noEl += 1
      sampleErrs.push('noel ' + chart.id)
      continue
    }
    let instance: any
    try {
      instance = (window as any).echarts.init(el, null, { renderer: 'canvas' })
    } catch (e: any) {
      counts.initFail += 1
      sampleErrs.push('init ' + String(e?.message || e).slice(0, 100))
      continue
    }
    try {
      const baseLegend =
        chart.option && chart.option.legend && typeof chart.option.legend === 'object'
          ? chart.option.legend
          : {}
      const hasVisualMap = Boolean(chart.option && chart.option.visualMap)
      let option: any = {
        animation: false,
        backgroundColor: '#ffffff',
        ...chart.option,
        color: palette,
        legend: hasVisualMap
          ? { show: false, ...(baseLegend && baseLegend.show === true ? baseLegend : {}) }
          : {
              icon: 'roundRect',
              itemWidth: 12,
              itemHeight: 8,
              itemGap: 10,
              textStyle: { fontSize: 10, color: '#475569' },
              ...baseLegend,
              type: 'plain',
            },
      }
      if (option.maunaLayout != null) delete option.maunaLayout
      if (Array.isArray(option.series)) {
        let paletteIndex = 0
        option.series = option.series.map((s: any) => {
          if (!s || typeof s !== 'object') return s
          const isHiddenBand = s.stack === 'squad-range'
          const lineStyle = s.lineStyle && typeof s.lineStyle === 'object' ? s.lineStyle : {}
          const itemStyle = s.itemStyle && typeof s.itemStyle === 'object' ? s.itemStyle : {}
          const explicit =
            (typeof lineStyle.color === 'string' && lineStyle.color) ||
            (typeof itemStyle.color === 'string' && itemStyle.color) ||
            ''
          let tint = explicit
          if (!tint && !isHiddenBand) {
            tint = palette[paletteIndex++ % Math.max(palette.length, 1)]
          } else if (!tint) {
            tint = 'transparent'
          }
          if (s.type === 'line' || s.type == null) {
            return {
              ...s,
              smooth: s.smooth == null ? 0.18 : s.smooth,
              showSymbol: false,
              symbol: 'none',
              symbolSize: 0,
              itemStyle: { ...itemStyle, color: itemStyle.color || tint },
              lineStyle: { width: 2.35, ...lineStyle, color: lineStyle.color || tint },
              emphasis: { focus: 'series', ...(s.emphasis || {}), lineStyle: { width: 3.1 } },
            }
          }
          return s
        })
      }
      try {
        instance.setOption(option, true)
      } catch (e1: any) {
        try {
          instance.setOption({ ...chart.option, animation: false }, true)
        } catch (e2: any) {
          counts.setFail += 1
          sampleErrs.push('set ' + String(e2?.message || e2).slice(0, 120))
          try {
            instance.dispose()
          } catch {}
          continue
        }
      }
      counts.ok += 1
    } catch (e: any) {
      counts.seriesMapFail += 1
      sampleErrs.push('map ' + String(e?.message || e).slice(0, 120))
      try {
        instance.dispose()
      } catch {}
    }
  }

  return {
    injectMissingHosts,
    paletteLen: palette.length,
    hostIds: Array.from(document.querySelectorAll('.chart-box')).map((el) => el.id),
    chartIds: charts.map((c: any) => c.id),
    idMismatch: charts.filter((c: any) => !document.getElementById(c.id)).map((c: any) => c.id),
    counts,
    sampleErrs,
    nativeReady: Array.from(document.querySelectorAll('.chart-box')).filter(
      (el) => (el as HTMLElement).dataset.ready === '1'
    ).length,
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
