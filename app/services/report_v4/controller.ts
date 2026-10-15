import type { HttpContext } from '@adonisjs/core/http'
import { fullStaffReportExportPdfSchema, fullStaffReportGenerateSchema } from '#services/report_v4/schema'
import ReportV4Service from '#services/report_v4/report_v4_service'
import {
  abortSignalFromHttp,
  isReportV4AbortedError,
} from '#services/report_v4/request_abort'
import {
  isJevUnavailableError,
  jevUnavailableMessage,
} from '#services/report_v4/jev_guard'
import { loadEchartsMinJs } from '#services/report_v4/report_v4_assets'
import { SseStreamHandler, sanitizeDownloadFilename } from '#services/report_v4/sse_utils'
import { detectReportLanguage } from '#services/report_v4/detect_report_language'
import {
  buildProgressEvent,
  FULL_GENERATION_STEPS,
  LOCAL_EDIT_STEPS,
  type ReportProgressStep,
} from '#services/report_v4/progress_events'

export default class ReportV4Controller {
  private service = new ReportV4Service()

  async generate(ctx: HttpContext) {
    const payload = await fullStaffReportGenerateSchema.validate(ctx.request.body())
    const language = detectReportLanguage(payload.prompt)
    const clubId = ctx.auth.user!.clubId
    const signal = abortSignalFromHttp(ctx)
    const sse = SseStreamHandler.open(ctx)
    const isLocalEdit = Boolean(payload.html || payload.document)
    const progressSteps = isLocalEdit ? LOCAL_EDIT_STEPS : FULL_GENERATION_STEPS

    try {
      const result = await this.service.generatePdf(
        clubId,
        payload,
        language,
        (message) => {
          if (signal.aborted) return
          const known = progressSteps.find((step) => {
            const event = buildProgressEvent({ step, language, steps: progressSteps })
            return event.label === message || event.status === message || step === message
          })
          if (known) {
            sse.sendEvent(buildProgressEvent({ step: known, language, steps: progressSteps }))
            return
          }
          const asStep = message as ReportProgressStep
          if (progressSteps.includes(asStep)) {
            sse.sendEvent(buildProgressEvent({ step: asStep, language, steps: progressSteps }))
            return
          }
          sse.sendEvent({ status: message })
        },
        signal
      )
      if (signal.aborted) {
        sse.sendEvent({ message: 'cancelled' }, 'cancelled')
        return
      }
      if (result.clarify?.needsClarify) {
        sse.sendEvent(
          {
            markdown: result.clarify.markdown,
            questions: result.clarify.questions,
            reason: result.clarify.reason,
            confidence: result.clarify.confidence,
            summary: result.summary ?? null,
            message: result.message,
            history: result.history,
            document: result.document,
            html: result.html,
            sessionFocus: result.sessionFocus,
            coverage: result.coverage,
            designPackId: result.designPackId,
          },
          'ask'
        )
        return
      }
      if (result.summary?.markdown) {
        sse.sendEvent(
          {
            markdown: result.summary.markdown,
            followUps: result.summary.followUps,
            pathCostClass: result.pathCostClass ?? null,
          },
          'summary'
        )
      }
      const filename = sanitizeDownloadFilename(result.filename)
      sse.sendEvent(
        {
          filename,
          pdfBase64: result.buffer.length ? result.buffer.toString('base64') : '',
          html: result.html,
          document: result.document,
          message: result.message,
          history: result.history,
          sessionFocus: result.sessionFocus,
          iterations: result.iterations,
          coverage: result.coverage,
          designPackId: result.designPackId,
          summary: result.summary ?? null,
          pathCostClass: result.pathCostClass ?? null,
        },
        'complete'
      )
    } catch (error) {
      if (isReportV4AbortedError(error) || signal.aborted) {
        sse.sendEvent({ message: 'cancelled' }, 'cancelled')
        return
      }
      const overflow =
        error instanceof Error &&
        (/E_REPORT_V4_DESIGNER_OVERFLOW/.test(String((error as { code?: string }).code ?? '')) ||
          /trop volumineuse|too large to process/i.test(error.message))
      const message = isJevUnavailableError(error)
        ? jevUnavailableMessage(language)
        : overflow && error instanceof Error
          ? error.message
          : error instanceof Error && error.message.trim() && !/ValidationException|AccessDenied|stack/i.test(error.message)
            ? error.message
            : language === 'fr'
              ? "La génération du rapport a échoué. Réessayez dans un instant."
              : 'Report generation failed. Please try again in a moment.'
      sse.sendEvent({ message }, 'error')
    } finally {
      sse.close()
    }
  }

  async exportPdf({ request, response, auth }: HttpContext) {
    const payload = await fullStaffReportExportPdfSchema.validate(request.body())
    const result = await this.service.exportFromHtml({
      ...payload,
      clubId: auth.user!.clubId,
    })
    const filename = sanitizeDownloadFilename(result.filename)
    return response.ok({
      filename,
      pdfBase64: result.buffer.toString('base64'),
    })
  }

  async coverage({ request, response, auth }: HttpContext) {
    const body = request.body() as { prompt?: string }
    const prompt =
      typeof body.prompt === 'string' && body.prompt.trim()
        ? body.prompt.trim()
        : typeof request.qs().prompt === 'string'
          ? String(request.qs().prompt)
          : 'coverage last 14 days'
    await fullStaffReportGenerateSchema.validate({ prompt })

    return response.ok({
      coverage: await this.service.coverage(auth.user!.clubId, prompt),
    })
  }

  async echartsAsset({ response }: HttpContext) {
    response.header('Content-Type', 'application/javascript; charset=utf-8')
    response.header('Cache-Control', 'public, max-age=86400, immutable')
    return response.send(loadEchartsMinJs())
  }
}
