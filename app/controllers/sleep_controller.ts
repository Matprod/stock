import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Athlete from '#models_pg/athlete'
import { deleteSleepParamsSchema, getSleepsSchema, upsertSleepSchema } from '#schemas/sleep'
import AthleteService from '#services/athlete_service'
import { SubjectiveScaleService } from '#services/subjective_scale_service'
import { SubjectiveScaleValuesService } from '#services/subjective_scale_values_service'
import { SUBJECTIVE_VARIABLE_DOMAIN } from '#contracts/subjective_variable'
import { getLanguageFromRequest } from '#utils/language'
import Sleep from '#models_pg/sleep'

export default class SleepController {
  private athleteService = new AthleteService()
  private subjectiveScaleService = new SubjectiveScaleService()
  private subjectiveScaleValuesService = new SubjectiveScaleValuesService()

  async getSleeps({ request, response, auth }: HttpContext) {
    const { from, to, athleteId } = await getSleepsSchema.validate(request.qs())

    const sleeps = await Sleep.query()
      .whereHas('day', (q) => {
        q.whereHas('athlete', (a) => a.where('clubId', auth.user!.clubId)).whereBetween(
          'dateOfDay',
          [from, to]
        )
        if (athleteId !== undefined) q.where('athleteId', athleteId)
      })
      .preload('day', (q) => q.preload('athlete'))
      .exec()

    return response.json({
      sleeps: sleeps.map((sleep) => {
        const { day, ...sleepData } = sleep.toJSON()
        return { ...sleepData, dayDate: sleep.day.dateOfDay, athleteId: sleep.day.athleteId }
      }),
    })
  }

  async upsertSleep({ request, response, auth }: HttpContext) {
    const language = getLanguageFromRequest(request)
    const sleepScales = await this.subjectiveScaleService.getScales(auth.user!.clubId, language, {
      domains: [SUBJECTIVE_VARIABLE_DOMAIN.SLEEP],
    })
    const sleepScale = sleepScales[0]
    if (!sleepScale) {
      return response.badRequest({ error: 'Sleep scale not configured for this club' })
    }

    const { date, athleteId, bedtimeDate, wakeUpDate, qualityRating } = await upsertSleepSchema({
      min: sleepScale.min,
      max: sleepScale.max,
    }).validate(request.body())

    const athlete = await Athlete.find(athleteId)
    if (!athlete || athlete.clubId !== auth.user!.clubId) {
      return response.notFound({ error: 'Athlete not found' })
    }

    const day = await this.athleteService.getOrCreateDay(athleteId, DateTime.fromJSDate(date))
    const bedtime = DateTime.fromJSDate(bedtimeDate)
    const wakeup = DateTime.fromJSDate(wakeUpDate)
    const totalInBed = Math.max(0, wakeup.diff(bedtime).toMillis())
    const schedulePayload = {
      bedtimeDate: bedtime,
      wakeUpDate: wakeup,
      totalInBedTimeMilli: totalInBed,
    }

    const existing = await day.related('sleeps').query().first()
    const sleep = existing
      ? await existing.merge(schedulePayload).save()
      : await day.related('sleeps').create({ ...schedulePayload, dataSource: 'manual' })

    await this.subjectiveScaleValuesService.applySleep(sleep, sleepScales, {
      [sleepScale.fieldName]: qualityRating,
    })

    return response.json(sleep)
  }

  async deleteSleep({ params, auth, response }: HttpContext) {
    const { id } = await deleteSleepParamsSchema.validate(params)

    const sleep = await Sleep.query()
      .where('id', id)
      .whereHas('day', (dayQuery) => {
        dayQuery.whereHas('athlete', (athleteQuery) => {
          athleteQuery.where('clubId', auth.user!.clubId)
        })
      })
      .first()

    if (!sleep) {
      return response.notFound({ error: 'Sleep not found' })
    }

    await sleep.delete()

    return response.noContent()
  }
}
