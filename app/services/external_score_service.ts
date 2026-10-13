import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import Day from '#models_pg/day'
import Athlete from '#models_pg/athlete'
import ThresholdsService from '#services/thresholds_service'
import { EXTERNAL_API_SCORE_MAX_RANGE_DAYS } from '#constants/external_api.constants'
import type { ExternalDayScore, ExternalScoresResponse } from '#contracts/external_api'

const serializeDayScore = (day: Day): ExternalDayScore => {
  return {
    athleteId: day.athleteId,
    date: day.dateOfDay.toFormat('yyyy-MM-dd'),
    performanceScore: day.performanceScore,
    injuryRiskScore: day.injuryRiskScore,
  }
}

export default class ExternalScoreService {
  constructor(private readonly thresholdsService = new ThresholdsService()) {}

  async listByClub({
    clubId,
    from,
    to,
    athleteId,
  }: {
    clubId: string
    from: string
    to: string
    athleteId?: string
  }): Promise<ExternalScoresResponse> {
    const fromDate = DateTime.fromISO(from)
    const toDate = DateTime.fromISO(to)

    if (!fromDate.isValid || !toDate.isValid || fromDate > toDate) {
      throw new Exception('Invalid date range', { status: 422 })
    }

    if (toDate.diff(fromDate, 'days').days > EXTERNAL_API_SCORE_MAX_RANGE_DAYS) {
      throw new Exception(`Date range cannot exceed ${EXTERNAL_API_SCORE_MAX_RANGE_DAYS} days`, {
        status: 422,
      })
    }

    if (athleteId) {
      const athlete = await Athlete.query()
        .where('id', athleteId)
        .where('clubId', clubId)
        .select('id')
        .first()

      if (!athlete) {
        throw new Exception('Athlete not found', { status: 404 })
      }
    }

    const query = Day.query()
      .select(['athleteId', 'dateOfDay', 'performanceScore', 'injuryRiskScore'])
      .whereHas('athlete', (athleteQuery) => {
        athleteQuery
          .where('clubId', clubId)
          .whereRaw('start_date <= days.date_of_day')
          .where((q) => {
            q.whereNull('endDate').orWhereRaw('end_date >= days.date_of_day')
          })
      })
      .whereBetween('dateOfDay', [from, to])
      .orderBy('dateOfDay', 'asc')
      .orderBy('athleteId', 'asc')

    if (athleteId) {
      query.where('athleteId', athleteId)
    }

    const [days, thresholds] = await Promise.all([
      query,
      this.thresholdsService.getThresholdsByClubId(clubId),
    ])

    return {
      data: days.map(serializeDayScore),
      thresholds: {
        performance: thresholds.thresholds.performance,
        injury: thresholds.thresholds.injury,
      },
    }
  }
}
