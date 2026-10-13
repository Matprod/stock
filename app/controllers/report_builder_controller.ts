import type { HttpContext } from '@adonisjs/core/http'
import { legacyReportGoneBody } from '#services/report_v4/legacy_gone'
import { getLanguageFromRequest } from '#utils/language'

export default class ReportBuilderController {
  async catalog({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }

  async generate({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }

  async chatbot({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }

  async exportPdf({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }

  async store({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }

  async index({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }

  async show({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }

  async update({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }

  async destroy({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }

  async generateSaved({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }

  async exportSavedPdf({ request, response }: HttpContext) {
    return response.gone(legacyReportGoneBody(getLanguageFromRequest(request)))
  }
}
