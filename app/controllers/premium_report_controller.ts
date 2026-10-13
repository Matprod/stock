import type { HttpContext } from '@adonisjs/core/http'
import {
  premiumReportGenerateSchema,
  premiumReportIdParamsSchema,
  premiumReportPdfSchema,
  premiumReportSaveSchema,
  premiumReportUpdateSchema,
} from '#schemas/premium_report'
import PremiumReportService from '#services/premium_report_service'
import PremiumReportStore from '#services/premium_report_store'
import type { ReportPdfFile } from '#services/report_builder/pdf/pdf_renderer'
import { getLanguageFromRequest } from '#utils/language'

const sendPdf = (response: HttpContext['response'], file: ReportPdfFile) => {
  const filename = file.filename.replace(/["\\\r\n]/g, '_')
  return response
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .send(file.buffer)
}

export default class PremiumReportController {
  private premiumReportService = new PremiumReportService()
  private store = new PremiumReportStore()

  async index({ response, auth }: HttpContext) {
    const reports = await this.store.list(auth.user!.clubId, auth.user!.id)
    return response.ok(reports)
  }

  async show({ params, response, auth }: HttpContext) {
    const { id } = await premiumReportIdParamsSchema.validate(params)
    const report = await this.store.get(auth.user!.clubId, id)
    return response.ok(report)
  }

  async save({ request, response, auth }: HttpContext) {
    const payload = await premiumReportSaveSchema.validate(request.body())
    const report = await this.store.create({
      clubId: auth.user!.clubId,
      userId: auth.user!.id,
      title: payload.title,
      document: payload.document,
      history: payload.history,
      language: getLanguageFromRequest(request),
    })
    return response.created(report)
  }

  async update({ params, request, response, auth }: HttpContext) {
    const { id } = await premiumReportIdParamsSchema.validate(params)
    const payload = await premiumReportUpdateSchema.validate(request.body())
    const report = await this.store.update(auth.user!.clubId, id, {
      title: payload.title,
      document: payload.document,
      history: payload.history,
      language: getLanguageFromRequest(request),
    })
    return response.ok(report)
  }

  async destroy({ params, response, auth }: HttpContext) {
    const { id } = await premiumReportIdParamsSchema.validate(params)
    await this.store.remove(auth.user!.clubId, id)
    return response.noContent()
  }

  async generate({ request, response, auth }: HttpContext) {
    const payload = await premiumReportGenerateSchema.validate(request.body())
    const language = getLanguageFromRequest(request)
    const result = await this.premiumReportService.generate(auth.user!.clubId, payload, language)
    return response.ok(result)
  }

  async exportPdf({ request, response, auth }: HttpContext) {
    const payload = await premiumReportPdfSchema.validate(request.body())
    const language = getLanguageFromRequest(request)
    const file = await this.premiumReportService.exportPdf(
      auth.user!.clubId,
      payload.document,
      language
    )
    return sendPdf(response, file)
  }
}
