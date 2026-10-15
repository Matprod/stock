import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'
import { readFile, writeFile } from 'node:fs/promises'

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

const { renderHtmlToPdf } = await import('#services/report_v4/playwright_pdf')
const html = await readFile(
  'tmp/reports_drafts/fait-moi-un-rapport-sur-la-semaine-derniere-fait-2026-10-05_2026-10-11.html',
  'utf8'
)
const pdf = await renderHtmlToPdf({
  html,
  filename: 'verify-force-paint.pdf',
  saveHtmlDraft: false,
})
await writeFile('tmp/canari_runs/verify_force_paint.pdf', pdf.buffer)
console.log(
  JSON.stringify({
    ok: true,
    bytes: pdf.buffer.length,
    chartsReady: pdf.chartsReady,
    boxesReady: pdf.boxesReady,
    chartBoxes: pdf.chartBoxes,
  })
)
