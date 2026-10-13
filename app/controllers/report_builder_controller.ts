import type { HttpContext } from '@adonisjs/core/http'
import {
  catalogQuerySchema,
  generateReportSchema,
  reportIdParamsSchema,
  reportChatbotSchema,
  upsertReportSchema,
} from '#schemas/report_builder'
import type { ReportPdfFile } from '#services/report_builder/pdf/pdf_renderer'
import ReportBuilderService from '#services/report_builder_service'
import ReportGeneratorChatbotService from '#services/report_builder/chatbot/report_generator_chatbot_service'
import { getLanguageFromRequest } from '#utils/language'

const sendPdf = (response: HttpContext['response'], file: ReportPdfFile) => {
  const filename = file.filename.replace(/["\\\r\n]/g, '_')
  return response
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .send(file.buffer)
}

export default class ReportBuilderController {
  private reportBuilderService = new ReportBuilderService()
  private reportGeneratorChatbotService = new ReportGeneratorChatbotService()

  async catalog({ request, response, auth }: HttpContext) {
    const query = await catalogQuerySchema.validate(request.qs())
    const language = getLanguageFromRequest(request)
    const dateRange = query.from && query.to ? { from: query.from, to: query.to } : undefined

    const catalog = await this.reportBuilderService.getCatalog(
      auth.user!.clubId,
      language,
      dateRange,
      query.useImputedMetrics === 'true'
    )
    return response.ok(catalog)
  }

  async generate({ request, response, auth }: HttpContext) {
    const payload = await generateReportSchema.validate(request.body())
    const document = await this.reportBuilderService.generate(auth.user!.clubId, payload)
    return response.ok({ document })
  }

  async chatbot({ request, response, auth }: HttpContext) {
    const payload = await reportChatbotSchema.validate(request.body())
    const language = getLanguageFromRequest(request)
    const result = await this.reportGeneratorChatbotService.chat(
      auth.user!.clubId,
      payload,
      language
    )
    return response.ok(result)
  }

  async exportPdf({ request, response, auth }: HttpContext) {
    const payload = await generateReportSchema.validate(request.body())
    const language = getLanguageFromRequest(request)
    const file = await this.reportBuilderService.exportPdf(auth.user!.clubId, payload, language)
    return sendPdf(response, file)
  }

  async store({ request, response, auth }: HttpContext) {
    const payload = await upsertReportSchema.validate(request.body())
    const report = await this.reportBuilderService.create(auth.user!.clubId, auth.user!.id, payload)
    return response.created({ report })
  }

  async index({ response, auth }: HttpContext) {
    const reports = await this.reportBuilderService.list(auth.user!.clubId)
    return response.ok({ reports })
  }

  async show({ params, response, auth }: HttpContext) {
    const { id } = await reportIdParamsSchema.validate(params)
    const report = await this.reportBuilderService.getOne(auth.user!.clubId, id)
    return response.ok({ report })
  }

  async update({ params, request, response, auth }: HttpContext) {
    const { id } = await reportIdParamsSchema.validate(params)
    const payload = await upsertReportSchema.validate(request.body())
    const report = await this.reportBuilderService.update(auth.user!.clubId, id, payload)
    return response.ok({ report })
  }

  async destroy({ params, response, auth }: HttpContext) {
    const { id } = await reportIdParamsSchema.validate(params)
    await this.reportBuilderService.delete(auth.user!.clubId, id)
    return response.noContent()
  }

  async generateSaved({ params, response, auth }: HttpContext) {
    const { id } = await reportIdParamsSchema.validate(params)
    const document = await this.reportBuilderService.generateFromSaved(auth.user!.clubId, id)
    return response.ok({ document })
  }

  async exportSavedPdf({ params, request, response, auth }: HttpContext) {
    const { id } = await reportIdParamsSchema.validate(params)
    const language = getLanguageFromRequest(request)
    const file = await this.reportBuilderService.exportPdfFromSaved(auth.user!.clubId, id, language)
    return sendPdf(response, file)
  }
}
