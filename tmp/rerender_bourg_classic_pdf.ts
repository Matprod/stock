import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'
import { readFile, writeFile, copyFile } from 'node:fs/promises'
import { join } from 'node:path'

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
const html = await readFile('tmp/canari_runs/bourg_fix_classic.html', 'utf8')
const pdf = await renderHtmlToPdf({ html, filename: 'bourg_fix_classic.pdf', saveHtmlDraft: true })
await writeFile('tmp/canari_runs/bourg_fix_classic.pdf', pdf.buffer)
await copyFile(
  'tmp/canari_runs/bourg_fix_classic.pdf',
  join('/Users/matprod/Desktop/utile/freelance/report generator', 'bourg_fix_classic.pdf')
)
console.log(
  JSON.stringify({
    ok: true,
    bytes: pdf.buffer.length,
    chartsReady: pdf.chartsReady,
    boxesReady: pdf.boxesReady,
    chartBoxes: pdf.chartBoxes,
  })
)
