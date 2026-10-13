import type { HttpContext } from '@adonisjs/core/http'
import {
  premiumReportIdParamsSchema,
  premiumReportSaveSchema,
  premiumReportUpdateSchema,
} from '#schemas/premium_report'
import PremiumReportStore from '#services/premium_report_store'
import { legacyReportGoneBody } from '#services/report_v4/legacy_gone'
import { getLanguageFromRequest } from '#utils/language'

export default class PremiumReportController {
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

  async generate({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }

  async exportPdf({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }
}
