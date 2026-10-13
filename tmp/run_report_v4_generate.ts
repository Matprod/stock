import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'
import { mkdir, writeFile } from 'node:fs/promises'
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

if (!clubId || !prompt) {
  console.error('REPORT_V4_CLUB_ID and REPORT_V4_PROMPT are required')
  process.exit(1)
}

const ignitor = new Ignitor(APP_ROOT, { importer: IMPORTER })
const app = ignitor.createApp('console')
await app.init()
await app.boot()

const ReportV4Service = (await import('#services/report_v4/report_v4_service')).default
const service = new ReportV4Service()

const history = historyJson ? JSON.parse(historyJson) : undefined
const sessionFocus = sessionFocusJson ? JSON.parse(sessionFocusJson) : undefined
const document = documentJson ? JSON.parse(documentJson) : undefined
let html: string | undefined
if (htmlPath) {
  const { readFile } = await import('node:fs/promises')
  html = await readFile(htmlPath, 'utf8')
}

const started = Date.now()
console.error(`[runner] start club=${clubId} tag=${outTag}`)
try {
  const result = await service.generatePdf(
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
    'fr',
    (message) => console.error(`[progress] ${message}`)
  )
  const outDir = join(process.cwd(), 'tmp', 'canari_runs')
  await mkdir(outDir, { recursive: true })
  const base = join(outDir, outTag)
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
        message: result.message,
        designPackId: result.designPackId,
        coverage: result.coverage,
        sessionFocus: result.sessionFocus,
        blockCount: result.document?.blocks?.length ?? 0,
        chartCount:
          result.document?.blocks?.filter((b: { type: string }) => b.type === 'chart').length ?? 0,
        blockTitles: (result.document?.blocks ?? []).map((b: { id: string; type: string; title?: string }) => ({
          id: b.id,
          type: b.type,
          title: b.title ?? null,
        })),
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
  console.error(`[runner] done tag=${outTag} sec=${((Date.now() - started) / 1000).toFixed(1)}`)
  console.log(
    JSON.stringify({
      ok: true,
      tag: outTag,
      iterations: result.iterations,
      costUsd: result.usage?.estimatedCostUsd,
      coverage: result.coverage,
      sessionFocus: result.sessionFocus,
      designPackId: result.designPackId,
      htmlPath: `${base}.html`,
      metaPath: `${base}.meta.json`,
    })
  )
} catch (error) {
  console.error('[runner] FAILED', error)
  process.exitCode = 1
} finally {
  await app.terminate()
}
