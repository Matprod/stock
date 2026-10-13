import HealthPain from '#models_pg/health_pain'
import HealthRating from '#models_pg/health_rating'
import Day from '#models_pg/day'
import AthleteService from '#services/athlete_service'
import { SubjectiveScaleValuesService } from '#services/subjective_scale_values_service'
import { DateTime } from 'luxon'
import DiscomfortLocation from '#models_pg/pain_discomfort_location'
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants'
import { TranslationService } from '#services/translation_service'
import { AppLanguage } from '#utils/localize'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { SubjectiveScaleFieldResponse } from '#contracts/subjective_scale'
import type { AddHealthPayload } from '#schemas/mobile/health'

interface AddOrUpdateHealthOptions {
  pains?: AddHealthPayload['pains']
  ratings?: Record<string, number | null>
  metrics?: Record<string, number | null>
  clubScales: SubjectiveScaleFieldResponse[]
}

export default class HealthService {
  private athleteService = new AthleteService()
  private translationService = new TranslationService()
  private subjectiveScaleValuesService = new SubjectiveScaleValuesService()

  public async getHealth(athleteId: string, dateOfDay: Date) {
    return HealthRating.query()
      .whereHas('day', (query: ModelQueryBuilderContract<typeof Day>) => {
        query.where('athleteId', athleteId).where('dateOfDay', dateOfDay)
      })
      .preload('pains', (painsQuery) => painsQuery.preload('location'))
      .first()
  }

  public async addOrUpdateHealth(
    athleteId: string,
    dateOfDay: Date,
    options: AddOrUpdateHealthOptions
  ): Promise<HealthRating> {
    const day = await this.athleteService.getOrCreateDay(athleteId, DateTime.fromJSDate(dateOfDay))

    const health = await HealthRating.updateOrCreate({ dayId: day.id }, { dayId: day.id })

    const pains = options.pains ?? []
    const painLocationIds = pains.map((p) => p.location)
    await HealthPain.query()
      .where('healthId', health.id)
      .if(painLocationIds.length > 0, (q) => q.whereNotIn('locationId', painLocationIds))
      .delete()
    if (pains.length) {
      await HealthPain.updateOrCreateMany(
        ['healthId', 'locationId'],
        pains.map((p) => ({ healthId: health.id, locationId: p.location, rating: p.rating }))
      )
    }

    // const travels = payload.travels ?? []
    // const travelVehicles = travels.map((t) => t.vehicle)
    // await Travel.query()
    //   .where('healthId', health.id)
    //   .if(travelVehicles.length > 0, (q) => q.whereNotIn('meanOfTransport', travelVehicles))
    //   .delete()
    // if (travels.length) {
    //   await Travel.updateOrCreateMany(
    //     ['healthId', 'meanOfTransport'],
    //     travels.map((t) => ({
    //       healthId: health.id,
    //       meanOfTransport: t.vehicle as TravelType,
    //       durationMinutes: Math.round((parseTimeToSeconds(t.duration) ?? 0) / 60),
    //     }))
    //   )
    // }
    await this.subjectiveScaleValuesService.applyHealth(health, options.clubScales, {
      ratings: options.ratings,
      metrics: options.metrics,
    })

    await health.load('pains', (painsQuery) => painsQuery.preload('location'))

    return health
  }

  public async buildHealthResponse(
    health: HealthRating,
    clubScales: SubjectiveScaleFieldResponse[]
  ) {
    await health.load('metricValues', (query) => query.preload('metric'))
    const { ratings, metrics } = this.subjectiveScaleValuesService.readHealthSplit(
      health,
      clubScales
    )

    return {
      id: health.id,
      ratings,
      metrics,
      pains: health.pains?.map((pain) => pain.serialize()) ?? [],
    }
  }

  public async getDiscomfortLocations(language: AppLanguage) {
    const locations = await DiscomfortLocation.query().preload('zone').orderBy('name')
    await this.translationService.applyTranslatedNames(
      locations.filter(
        (location): location is DiscomfortLocation & { name: string } => location.name != null
      ),
      TRANSLATABLE_TYPES.PAIN_DISCOMFORT_LOCATION,
      TRANSLATION_KEYS.PAIN_DISCOMFORT_LOCATION_NAME,
      language
    )
    return locations
  }

  public async translatePainLocations(
    locations: Array<{ id: string; name: string | null } | null | undefined>,
    language: AppLanguage
  ) {
    await this.translationService.applyTranslatedNames(
      locations.filter(
        (location): location is { id: string; name: string } =>
          location != null && location.name != null
      ),
      TRANSLATABLE_TYPES.PAIN_DISCOMFORT_LOCATION,
      TRANSLATION_KEYS.PAIN_DISCOMFORT_LOCATION_NAME,
      language
    )
  }

  public async getRecentFoodSupplements(_athleteId: string) {
    return []
  }

  public async getUtilities(_athleteId: string, language: AppLanguage) {
    const painLocations = await this.getDiscomfortLocations(language)

    return {
      foodSupplementNames: [],
      painLocations,
      recentFoodSupplements: [],
    }
  }
}
