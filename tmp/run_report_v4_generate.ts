import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const APP_ROOT = new URL('../', import.meta.url)
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

const clubId = process.env.REPORT_V4_CLUB_ID
const prompt = process.env.REPORT_V4_PROMPT
const outTag = process.env.REPORT_V4_OUT_TAG || 'run'
const historyJson = process.env.REPORT_V4_HISTORY_JSON
const htmlPath = process.env.REPORT_V4_HTML_PATH
const documentJson = process.env.REPORT_V4_DOCUMENT_JSON
const designPackId = process.env.REPORT_V4_DESIGN_PACK_ID
const sessionFocusJson = process.env.REPORT_V4_SESSION_FOCUS_JSON
const skipPdf = process.env.REPORT_V4_SKIP_PDF !== '0'
const baselineDir = process.env.REPORT_V4_BASELINE_DIR

if (!clubId || !prompt) {
  console.error('REPORT_V4_CLUB_ID and REPORT_V4_PROMPT are required')
  process.exit(1)
}

const ignitor = new Ignitor(APP_ROOT, { importer: IMPORTER })
const app = ignitor.createApp('console')
await app.init()
await app.boot()

const ReportV4Service = (await import('#services/report_v4/report_v4_service')).default
const { renderHtmlToPdf } = await import('#services/report_v4/playwright_pdf')
const { detectReportLanguage } = await import('#services/report_v4/detect_report_language')
const { parseAppLanguage } = await import('#utils/localize')
const service = new ReportV4Service()

const history = historyJson ? JSON.parse(historyJson) : undefined
const sessionFocus = sessionFocusJson ? JSON.parse(sessionFocusJson) : undefined
const document = documentJson ? JSON.parse(documentJson) : undefined
let html: string | undefined
if (htmlPath) {
  const { readFile } = await import('node:fs/promises')
  html = await readFile(htmlPath, 'utf8')
}

const language =
  parseAppLanguage(process.env.REPORT_V4_LANGUAGE) ?? detectReportLanguage(prompt)

const { isReportV4FreeDesignerEnabled, isReportV4FreeDesignerRefsEnabled } = await import(
  '#services/report_v4/free_designer/flag'
)
const freeDesigner = isReportV4FreeDesignerEnabled()
const freeDesignerRefs = isReportV4FreeDesignerRefsEnabled()

const started = Date.now()
console.error(
  `[runner] start club=${clubId} tag=${outTag} skipPdf=${skipPdf} language=${language} freeDesigner=${freeDesigner ? 1 : 0} freeDesignerRefs=${freeDesignerRefs ? 1 : 0}`
)
const outDir = join(process.cwd(), 'tmp', 'canari_runs')
await mkdir(outDir, { recursive: true })
const base = join(outDir, outTag)

try {
  const result = await service.generate(
    clubId,
    {
      prompt,
      skipPdf: true,
      ...(history ? { history } : {}),
      ...(sessionFocus ? { sessionFocus } : {}),
      ...(document ? { document } : {}),
      ...(html ? { html } : {}),
      ...(designPackId ? { designPackId } : {}),
    },
    language,
    (message) => console.error(`[progress] ${message}`)
  )

  const repairHits = (result as { iterationSecs?: number[] }).iterationSecs
  await writeFile(`${base}.html`, result.html ?? '', 'utf8')
  await writeFile(
    `${base}.meta.json`,
    JSON.stringify(
      {
        clubId,
        prompt,
        durationSec: Number(((Date.now() - started) / 1000).toFixed(3)),
        iterations: result.iterations,
        usage: result.usage,
        iterationSecs: result.iterationSecs,
        iterationCosts: result.iterationCosts,
        message: result.message,
        designPackId: result.designPackId,
        coverage: result.coverage,
        sessionFocus: result.sessionFocus,
        blockCount: result.document?.blocks?.length ?? 0,
        chartCount:
          result.document?.blocks?.filter((b: { type: string }) => b.type === 'chart').length ?? 0,
        blockTitles: (result.document?.blocks ?? []).map(
          (b: { id: string; type: string; title?: string }) => ({
            id: b.id,
            type: b.type,
            title: b.title ?? null,
          })
        ),
        pdfOk: false,
        pdfError: null as string | null,
        repairHits: repairHits ?? null,
        freeDesigner,
        freeDesignerRefs,
      },
      null,
      2
    ),
    'utf8'
  )
  if (result.document) {
    await writeFile(`${base}.document.json`, JSON.stringify(result.document, null, 2), 'utf8')
  }
  if (result.history) {
    await writeFile(`${base}.history.json`, JSON.stringify(result.history, null, 2), 'utf8')
  }

  let pdfOk = false
  let pdfError: string | null = null
  let pdfPath: string | undefined
  if (!skipPdf && result.html) {
    try {
      console.error('[runner] rendering PDF…')
      const pdf = await renderHtmlToPdf({
        html: result.html,
        filename: `${outTag}.pdf`,
        saveHtmlDraft: true,
      })
      pdfOk = true
      pdfPath = join(outDir, `${outTag}.pdf`)
      await writeFile(pdfPath, pdf.buffer)
      if (pdf.htmlPath) {
        console.error(`[runner] draft html=${pdf.htmlPath}`)
      }
    } catch (error) {
      pdfError = error instanceof Error ? error.message : String(error)
      console.error('[runner] PDF FAILED', pdfError)
    }
  }

  const meta = JSON.parse(await (await import('node:fs/promises')).readFile(`${base}.meta.json`, 'utf8'))
  meta.pdfOk = pdfOk
  meta.pdfError = pdfError
  meta.durationSec = Number(((Date.now() - started) / 1000).toFixed(3))
  await writeFile(`${base}.meta.json`, JSON.stringify(meta, null, 2), 'utf8')

  if (baselineDir) {
    await mkdir(baselineDir, { recursive: true })
    await copyFile(`${base}.html`, join(baselineDir, `${outTag}.html`))
    await copyFile(`${base}.meta.json`, join(baselineDir, `${outTag}.meta.json`))
    if (pdfOk && pdfPath) {
      await copyFile(pdfPath, join(baselineDir, `${outTag}.pdf`))
    }
  }

  console.error(
    `[runner] done tag=${outTag} sec=${meta.durationSec} pdfOk=${pdfOk} cost=${result.usage?.estimatedCostUsd ?? '?'}`
  )
  console.log(
    JSON.stringify({
      ok: true,
      tag: outTag,
      iterations: result.iterations,
      costUsd: result.usage?.estimatedCostUsd,
      durationSec: meta.durationSec,
      pdfOk,
      pdfError,
      htmlPath: `${base}.html`,
      metaPath: `${base}.meta.json`,
      pdfPath: pdfPath ?? null,
    })
  )
} catch (error) {
  console.error('[runner] FAILED', error)
  process.exitCode = 1
} finally {
  await app.terminate()
}
