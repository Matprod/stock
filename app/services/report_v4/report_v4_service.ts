import logger from '@adonisjs/core/services/logger'
import Athlete from '#models_pg/athlete'
import { PREMIUM_REPORT_HISTORY_MAX } from '#constants/premium_report.constants'
import type {
  PremiumReportDocument,
  PremiumReportDocumentDraft,
  PremiumReportHistoryTurn,
} from '#contracts/premium_report'
import {
  elapsedSec,
  type PremiumReportTokenUsage,
} from '#services/premium_report/premium_report_log'
import { logReportV4Done, logReportV4Pdf } from '#services/report_v4/report_v4_log'
import {
  runReportV4Orchestrator,
  type ReportV4OrchestratorResult,
} from '#services/report_v4/report_v4_orchestrator'
import { renderHtmlToPdf, slugFilename } from '#services/report_v4/playwright_pdf'
import { resolveFullCoverage, type ReportV4CoverageView } from '#services/report_v4/domain_coverage_probe'
import {
  normalizeSessionFocus,
  type ReportV4SessionFocus,
} from '#services/report_v4/session_focus'
import { isReportV4AbortedError, throwIfAborted } from '#services/report_v4/request_abort'
import { sanitizeDownloadFilename } from '#services/report_v4/sse_utils'
import type { AppLanguage } from '#utils/localize'

export type ReportV4ReportGenerateResult = Omit<
  ReportV4OrchestratorResult,
  'designPack' | 'route'
> & {
  designPackId: string
}

export type ReportV4GenerateInput = {
  prompt: string
  history?: PremiumReportHistoryTurn[]
  sessionFocus?: ReportV4SessionFocus
  document?: PremiumReportDocumentDraft
  html?: string
  designPackId?: string
  skipPdf?: boolean
}

export type ReportV4PdfResult = {
  buffer: Buffer
  filename: string
  message: string
  iterations: number
  usage: PremiumReportTokenUsage
  iterationSecs: number[]
  iterationCosts: number[]
  document: PremiumReportDocument
  history: PremiumReportHistoryTurn[]
  sessionFocus: ReportV4SessionFocus | null
  coverage: ReportV4ReportGenerateResult['coverage']
  designPackId: string
  html: string
  htmlPath?: string
  clarify?: ReportV4ReportGenerateResult['clarify']
  summary?: ReportV4ReportGenerateResult['summary']
  pathCostClass?: string
}

export default class ReportV4Service {
  async generatePdf(
    clubId: string,
    input: ReportV4GenerateInput,
    language: AppLanguage,
    onProgress?: (message: string) => void,
    signal?: AbortSignal
  ): Promise<ReportV4PdfResult> {
    const wallStarted = Date.now()
    const result = await this.generate(clubId, input, language, onProgress, signal)
    const filename = slugFilename(
      result.document.title || 'report-v4-report',
      result.coverage.displayRange.from,
      result.coverage.displayRange.to
    )

    throwIfAborted(signal)
    let pdfBuffer: Buffer = Buffer.alloc(0)
    let htmlPath: string | undefined
    const skipPdfForClarify = Boolean(result.clarify?.needsClarify)
    if (!input.skipPdf && !skipPdfForClarify) {
      onProgress?.(
        language === 'fr' ? 'Préparation du document...' : 'Preparing the document...'
      )
      const pdfStarted = Date.now()
      const pdf = await renderHtmlToPdf({ html: result.html, filename })
      pdfBuffer = Buffer.from(pdf.buffer)
      htmlPath = pdf.htmlPath
      logReportV4Pdf({
        durationSec: elapsedSec(pdfStarted),
        filename: pdf.filename,
        bytes: pdf.buffer.length,
      })
    }

    const nextHistory: PremiumReportHistoryTurn[] = [
      ...(input.history ?? []),
      { role: 'user' as const, content: input.prompt },
      { role: 'assistant' as const, content: result.message },
    ].slice(-PREMIUM_REPORT_HISTORY_MAX)

    logReportV4Done({
      iterations: result.iterations,
      durationSec: elapsedSec(wallStarted),
      usage: result.usage,
      iterationSecs: result.iterationSecs,
      iterationCosts: result.iterationCosts,
      filename,
      blockCount: result.document.blocks.length,
      chartCount: result.document.blocks.filter((block) => block.type === 'chart').length,
    })

    return {
      buffer: pdfBuffer,
      filename,
      message: result.message,
      iterations: result.iterations,
      usage: result.usage,
      iterationSecs: result.iterationSecs,
      iterationCosts: result.iterationCosts,
      document: result.document,
      history: nextHistory,
      sessionFocus: result.sessionFocus,
      coverage: result.coverage,
      designPackId: result.designPackId,
      html: result.html,
      clarify: result.clarify ?? null,
      summary: result.summary ?? null,
      pathCostClass: result.pathCostClass,
      ...(htmlPath ? { htmlPath } : {}),
    }
  }

  async exportFromHtml(args: {
    html: string
    filename?: string
    clubId?: string
  }): Promise<{ buffer: Buffer; filename: string }> {
    const raw = sanitizeDownloadFilename(args.filename ?? '').trim()
    const filename =
      raw && raw.toLowerCase().endsWith('.pdf') ? raw : `${raw || 'report-v4'}.pdf`
    const pdf = await renderHtmlToPdf({ html: args.html, filename })
    return { buffer: Buffer.from(pdf.buffer), filename: pdf.filename }
  }

  async generate(
    clubId: string,
    input: ReportV4GenerateInput,
    language: AppLanguage,
    onProgress?: (message: string) => void,
    signal?: AbortSignal
  ): Promise<ReportV4ReportGenerateResult> {
    const started = Date.now()
    try {
      const result = await runReportV4Orchestrator({
        clubId,
        prompt: input.prompt,
        language,
        history: input.history,
        sessionFocus: normalizeSessionFocus(input.sessionFocus) ?? undefined,
        document: input.document,
        html: input.html,
        designPackId: input.designPackId,
        onProgress,
        signal,
      })
      const { designPack, route: _route, ...rest } = result
      return { ...rest, designPackId: designPack.id }
    } catch (error) {
      if (isReportV4AbortedError(error) || signal?.aborted) {
        logger.info(
          {
            clubId,
            durationSec: Number(((Date.now() - started) / 1000).toFixed(3)),
          },
          'report_v4_report.generate_cancelled'
        )
        throw error
      }
      logger.error(
        {
          err: error,
          clubId,
          durationSec: Number(((Date.now() - started) / 1000).toFixed(3)),
        },
        'report_v4_report.generate_failed'
      )
      throw error
    }
  }

  async coverage(clubId: string, prompt: string): Promise<ReportV4CoverageView> {
    const athleteIds = (await Athlete.query().where('clubId', clubId).select('id')).map(
      (row) => row.id
    )
    return resolveFullCoverage({ clubId, prompt, athleteIds })
  }
}
