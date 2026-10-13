import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import HealthRating from '#models_pg/health_rating'
import Athlete from '#models_pg/athlete'
import {
  deleteHealthParamsSchema,
  getHealthsSchema,
  upsertHealthSchema,
} from '#schemas/health'
import AthleteService from '#services/athlete_service'
import { SubjectiveScaleService } from '#services/subjective_scale_service'
import { SubjectiveScaleValuesService } from '#services/subjective_scale_values_service'
import { buildCalendarHealthRow } from '#contracts/subjective_value'
import { getLanguageFromRequest } from '#utils/language'

export default class HealthController {
  private athleteService = new AthleteService()
  private subjectiveScaleService = new SubjectiveScaleService()
  private subjectiveScaleValuesService = new SubjectiveScaleValuesService()

  async getHealths({ request, response, auth }: HttpContext) {
    const { from, to, athleteId } = await getHealthsSchema.validate(request.qs())
    const language = getLanguageFromRequest(request)
    const clubScales = await this.subjectiveScaleService.getScales(auth.user!.clubId, language)

    const healths = await HealthRating.query()
      .whereHas('day', (q) => {
        q.whereHas('athlete', (a) => a.where('clubId', auth.user!.clubId)).whereBetween(
          'dateOfDay',
          [from, to]
        )
        if (athleteId !== undefined) q.where('athleteId', athleteId)
      })
      .preload('day', (q) => q.preload('athlete'))
      .preload('metricValues', (metricValuesQuery) => metricValuesQuery.preload('metric'))

    return response.json(
      healths.map((health) => {
        const { ratings, metrics } = this.subjectiveScaleValuesService.readHealthSplit(
          health,
          clubScales
        )
        return buildCalendarHealthRow(health, ratings, metrics)
      })
    )
  }

  async upsertHealth({ request, response, auth }: HttpContext) {
    const language = getLanguageFromRequest(request)
    const clubScales = await this.subjectiveScaleService.getScales(auth.user!.clubId, language)
    const payload = await upsertHealthSchema.validate(request.body())

    const validationError = this.subjectiveScaleValuesService.validateHealthPayload(
      { ratings: payload.ratings, metrics: payload.metrics },
      clubScales
    )
    if (validationError) {
      return response.badRequest({ error: validationError })
    }

    const athlete = await Athlete.find(payload.athleteId)
    if (!athlete || athlete.clubId !== auth.user!.clubId) {
      return response.notFound({ error: 'Athlete not found' })
    }

    const day = await this.athleteService.getOrCreateDay(
      payload.athleteId,
      DateTime.fromJSDate(payload.date)
    )
    const health = await HealthRating.updateOrCreate({ dayId: day.id }, { dayId: day.id })

    await this.subjectiveScaleValuesService.applyHealth(health, clubScales, {
      ratings: payload.ratings,
      metrics: payload.metrics,
    })

    await health.load('day')

    const { ratings, metrics } = this.subjectiveScaleValuesService.readHealthSplit(
      health,
      clubScales
    )

    return response.json(buildCalendarHealthRow(health, ratings, metrics))
  }

  async deleteHealth({ params, auth, response }: HttpContext) {
    const { id } = await deleteHealthParamsSchema.validate(params)

    const health = await HealthRating.query()
      .where('id', id)
      .whereHas('day', (dayQuery) => {
        dayQuery.whereHas('athlete', (athleteQuery) => {
          athleteQuery.where('clubId', auth.user!.clubId)
        })
      })
      .first()

    if (!health) {
      return response.notFound({ error: 'Health not found' })
    }

    await health.delete()

    return response.noContent()
  }
}
