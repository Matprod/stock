import { TRAIN_MY_ATHLETE_OCCURRED_IN_TO_CONTEXT } from '#constants/train_my_athlete.constants'
import {
  // TrainMyAthleteBodyComposition,
  TrainMyAthleteDiagnosis,
  TrainMyAthleteInjury,
  TrainMyAthleteResponse,
  TrainMyAthleteScreeningEntry,
} from '#contracts/train_my_athlete'
import Injury from '#models_pg/injury'
import InjurySection from '#models_pg/injury_section'
import Zone from '#models_pg/zone'
import InjuryType from '#models_pg/injury_type'
import { DateTime } from 'luxon'
import { capitalize } from '../utils/string.js'
import Athlete from '#models_pg/athlete'
import axios from 'axios'
import BodymetricsHistory from '#models_pg/bodymetrics_history'
import AthleteService from './athlete_service.js'
import Sleep from '#models_pg/sleep'
import HealthRating from '#models_pg/health_rating'
import { MetricService } from './metric_service.js'
import { MetricDomain } from '#contracts/metric'
import {
  ATHLETE_PROVIDER_SOURCE,
  ATHLETE_PROVIDER_TYPES,
} from '#constants/athlete_provider.constants'
import env from '#start/env'
import Disease from '#models_pg/disease'

export class TrainMyAthleteService {
  private readonly athleteService: AthleteService
  private readonly healthMetricService: MetricService
  private readonly baseUrl = 'https://api.trainmyathlete.com/graphql'

  constructor() {
    this.athleteService = new AthleteService()
    this.healthMetricService = new MetricService(MetricDomain.HEALTH)
  }

  private getResolvedAtDateTime(injury: TrainMyAthleteInjury): DateTime {
    return DateTime.fromISO(injury.resolved_at ?? injury.date)
  }

  public async getReports({
    from,
    to,
  }: {
    from: string
    to: string
  }): Promise<TrainMyAthleteResponse['data']['reports']> {
    const query = `
      query {
        reports(
          email: "${env.get('TRAIN_MY_ATHLETE_EMAIL')}"
          password: "${env.get('TRAIN_MY_ATHLETE_PASSWORD')}"
          orgSlug: "safc"
          from: "${from}"
          to: "${to}"
        )
      }
    `

    const response = await axios.post(
      this.baseUrl,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    return response.data.data.reports
  }

  public async processReports(reports: TrainMyAthleteResponse['data']['reports']): Promise<void> {
    await Promise.all(reports.injuries.map((injury) => this.processInjury(injury, 'appeared')))
    await Promise.all(
      reports.resolvedInjuries.map((injury) => this.processInjury(injury, 'resolved'))
    )
    const entriesByAthleteByDay = new Map<string, Map<string, TrainMyAthleteScreeningEntry[]>>()
    for (const entry of reports.screeningEntries) {
      const { date, athlete } = entry
      if (!entriesByAthleteByDay.has(athlete.id)) {
        entriesByAthleteByDay.set(athlete.id, new Map())
      }
      const byDay = entriesByAthleteByDay.get(athlete.id)!
      const formatedDate = DateTime.fromISO(date).toISODate()
      if (!formatedDate) {
        console.log(`Invalid date for screening entry: ${date}`)
        continue
      }
      if (!byDay.has(formatedDate)) {
        byDay.set(formatedDate, [])
      }
      byDay.get(formatedDate)!.push(entry)
    }
    await Promise.all(
      Array.from(entriesByAthleteByDay.entries()).map(([athleteId, entriesByDay]) =>
        this.processScreeningsForAthlete({
          athleteId,
          entriesByDay,
        })
      )
    )
    // await Promise.all(
    //   reports.bodyCompositions.map((bodyComposition) =>
    //     this.processBodyComposition(bodyComposition)
    //   )
    // )
  }

  // private async processBodyComposition(bodyComposition: TrainMyAthleteBodyComposition) {
  //   const { athlete: trainMyAthleteAthlete, date, weight } = bodyComposition

  //   const athlete = await Athlete.query()
  //     .whereHas('athleteProviders', (query) => {
  //       query
  //         .where('providerAthleteId', trainMyAthleteAthlete.id)
  //         query.where('provider', ATHLETE_PROVIDER_TYPES.TRAIN_MY_ATHLETE)
  //     })
  //     .first()

  //   if (!athlete) {
  //     return null
  //   }

  //   const day = await this.athleteService.getOrCreateDay(athlete.id, DateTime.fromISO(date))
  //   if (!day) {
  //     return null
  //   }

  //   if (weight) {
  //     let bodymetricsHistory: BodymetricsHistory | null = await BodymetricsHistory.query()
  //       .where('dayId', day.id)
  //       .first()

  //     if (!bodymetricsHistory) {
  //       bodymetricsHistory = new BodymetricsHistory()
  //       bodymetricsHistory.dayId = day.id
  //       bodymetricsHistory.athleteId = athlete.id
  //     }

  //     bodymetricsHistory.weight = weight
  //     await bodymetricsHistory.save()
  //   }

  //   const skinFoldFields = [
  //     'sf_right_tricep',
  //     'sf_right_bicep',
  //     'sf_subscap',
  //     'sf_suprailiac',
  //     'sf_supraspinale',
  //     'sf_abdominals',
  //     'sf_right_thigh',
  //     'sf_left_thigh',
  //     'sf_right_calf',
  //     'sf_left_calf',
  //   ] as const

  //   const metrics = skinFoldFields.reduce(
  //     (acc, field) => {
  //       const value = bodyComposition[field]
  //       if (value != null) {
  //         acc[field] = value
  //       }
  //       return acc
  //     },
  //     {} as Record<string, number>
  //   )

  //   if (Object.keys(metrics).length > 0) {
  //     let health = await Health.query().where('dayId', day.id).first()
  //     if (!health) {
  //       health = await Health.create({
  //         dayId: day.id,
  //       })
  //     }

  //     await this.healthMetricService.updateMetrics(health.id, metrics)
  //   }
  // }

  private async processScreeningsForAthlete({
    athleteId,
    entriesByDay,
  }: {
    athleteId: string
    entriesByDay: Map<string, TrainMyAthleteScreeningEntry[]>
  }) {
    const athlete = await Athlete.query()
      .whereHas('athleteProviders', (query) => {
        query
          .where('provider', ATHLETE_PROVIDER_TYPES.TRAIN_MY_ATHLETE)
          .where('providerAthleteId', athleteId)
      })
      .first()

    if (!athlete) {
      console.log(`Athlete not found: ${athleteId}`)
      return null
    }

    console.log(`Processing screenings for athlete ${athlete.id}`)
    await Promise.all(
      Array.from(entriesByDay.entries()).map(([date, entries]) =>
        this.processScreeningsForDayForAthlete({
          athleteId: athlete.id,
          date,
          entries,
        })
      )
    )
  }

  private async processScreeningsForDayForAthlete({
    athleteId,
    date,
    entries,
  }: {
    athleteId: string
    date: string
    entries: TrainMyAthleteScreeningEntry[]
  }) {
    const day = await this.athleteService.getOrCreateDay(athleteId, DateTime.fromISO(date))
    if (!day) {
      return null
    }

    let bodymetricsHistory: BodymetricsHistory | null = await BodymetricsHistory.query()
      .where('dayId', day.id)
      .first()
    let hasBodymetricsHistory = false

    let sleep: Sleep | null = await Sleep.query().where('dayId', day.id).first()
    let hasSleep = false

    let health: HealthRating | null = await HealthRating.query().where('dayId', day.id).first()
    let hasHealth = false
    const metrics = new Map<string, number>()

    for (const entry of entries) {
      const { screening, value } = entry
      switch (screening.name.toLowerCase()) {
        case 'height':
          break
        case 'body weight':
        case 'weight':
          if (!value) {
            break
          }
          bodymetricsHistory ??= new BodymetricsHistory()
          bodymetricsHistory.weight = value
          hasBodymetricsHistory = true
          break
        case 'sleep quality':
          sleep ??= new Sleep()
          sleep.qualityRating = value
          hasSleep = true
          break
        case 'sleep hours':
          sleep ??= new Sleep()
          sleep.totalInBedTimeMilli = value * 60 * 60 * 1000
          hasSleep = true
          break
        case 'energy':
          health ??= new HealthRating()
          health.energyRating = value
          hasHealth = true
          break
        case 'body soreness':
          health ??= new HealthRating()
          health.bodySorenessRating = value
          hasHealth = true
          break
        case 'mood':
          health ??= new HealthRating()
          health.moodRating = value
          hasHealth = true
          break
        default:
          metrics.set(screening.name, value)
          break
      }
    }

    if (bodymetricsHistory && hasBodymetricsHistory) {
      bodymetricsHistory.athleteId = athleteId
      bodymetricsHistory.dayId = day.id
    }
    if (sleep && hasSleep) {
      sleep.dayId = day.id
    }
    if ((health && hasHealth) || metrics.size > 0) {
      health ??= new HealthRating()
      health.dayId = day.id
    }

    await Promise.all([bodymetricsHistory?.save(), sleep?.save(), health?.save()])

    if (health && metrics.size > 0) {
      await this.healthMetricService.updateMetrics(health.id, Object.fromEntries(metrics))
    }
  }

  private async processViralIllness(
    athleteId: string,
    disease: TrainMyAthleteInjury,
    eventType: 'appeared' | 'resolved'
  ): Promise<Disease | null> {
    if (disease.diagnoses.length === 0 || disease.diagnoses[0].body_area !== 'Medical') {
      return null
    }

    const existingDisease = await Disease.query()
      .where('athleteId', athleteId)
      .where('source', ATHLETE_PROVIDER_SOURCE.TMA)
      .where('name', 'Viral illness')
      .where('startDate', DateTime.fromISO(disease.date).toJSDate())
      .first()

    if (existingDisease) {
      if (eventType === 'resolved' && existingDisease.endDate === null) {
        existingDisease.endDate = this.getResolvedAtDateTime(disease)
        return existingDisease.save()
      }
      return existingDisease
    }

    if (eventType === 'resolved') {
      return null
    }

    return Disease.create({
      athleteId,
      source: ATHLETE_PROVIDER_SOURCE.TMA,
      name: 'Viral illness',
      startDate: DateTime.fromISO(disease.date),
      endDate: null,
    })
  }

  public async processInjury(
    trainMyAthleteInjury: TrainMyAthleteInjury,
    eventType: 'appeared' | 'resolved' = 'appeared'
  ): Promise<Injury | Disease | null> {
    const trainMyAthleteId = trainMyAthleteInjury.athlete.id
    const athlete = await Athlete.query()
      .whereHas('athleteProviders', (query) => {
        query
          .where('provider', ATHLETE_PROVIDER_TYPES.TRAIN_MY_ATHLETE)
          .where('providerAthleteId', trainMyAthleteId)
      })
      .first()

    const hasUnavailabilities = trainMyAthleteInjury.unavailabilities.find(
      (unavailability) => unavailability.id !== null
    )

    if (
      !athlete ||
      !trainMyAthleteInjury.diagnoses ||
      trainMyAthleteInjury.diagnoses.length === 0 ||
      !hasUnavailabilities
    ) {
      return null
    }

    if (trainMyAthleteInjury.diagnoses[0].body_area === 'Medical') {
      console.log('Processing viral illness for athlete', athlete.firstName, athlete.lastName)
      return this.processViralIllness(athlete.id, trainMyAthleteInjury, eventType)
    }

    console.log('Processing injury for athlete', athlete.id)

    const diagnosis = trainMyAthleteInjury.diagnoses[0]

    const injuryType = await this.getInjuryType({
      diagnosis,
      clubId: athlete.clubId,
    })

    if (!injuryType) {
      return null
    }
    const existingInjury = await Injury.query()
      .where('athleteId', athlete.id)
      .where('source', ATHLETE_PROVIDER_SOURCE.TMA)
      .where('dateOfInjury', DateTime.fromISO(trainMyAthleteInjury.date).toJSDate())
      .where('typeOfInjuryId', injuryType.id)
      .first()

    if (existingInjury) {
      if (eventType === 'resolved' && existingInjury.recoveryDate === null) {
        existingInjury.recoveryDate = this.getResolvedAtDateTime(trainMyAthleteInjury)
      }
      existingInjury.merge({
        context: TRAIN_MY_ATHLETE_OCCURRED_IN_TO_CONTEXT[trainMyAthleteInjury.occurred_in],
        mechanism: diagnosis.mechanism,
        tissue: diagnosis.tissue,
        angle: diagnosis.angle,
        pathology: diagnosis.pathology,
      })
      return existingInjury.save()
    }

    if (eventType === 'resolved') {
      return null
    }

    return Injury.create({
      athleteId: athlete.id,
      source: ATHLETE_PROVIDER_SOURCE.TMA,
      typeOfInjuryId: injuryType.id,
      dateOfInjury: DateTime.fromISO(trainMyAthleteInjury.date),
      recoveryDate: null,
      context: TRAIN_MY_ATHLETE_OCCURRED_IN_TO_CONTEXT[trainMyAthleteInjury.occurred_in],
      mechanism: diagnosis.mechanism,
      tissue: diagnosis.tissue,
      angle: diagnosis.angle,
      pathology: diagnosis.pathology,
    })
  }

  private async getInjuryType({
    diagnosis,
    clubId,
  }: {
    diagnosis: TrainMyAthleteDiagnosis
    clubId: string
  }): Promise<InjuryType | null> {
    const categoryName =
      `${diagnosis.side !== 'unsided' ? `${diagnosis.side} ` : ''}${diagnosis.body_area}`.toLocaleLowerCase()

    const normalizedCategoryName = capitalize(categoryName)

    let injuryCategory = await InjurySection.query()
      .where('name', normalizedCategoryName)
      .orderBy('id', 'asc')
      .first()

    if (!injuryCategory) {
      const zone = await Zone.query().first()
      if (!zone) return null

      injuryCategory = await InjurySection.create({
        name: normalizedCategoryName,
        zoneId: zone.id,
      })
    }

    const normalizedInjuryTypeName = capitalize((diagnosis.name ?? '').trim().toLocaleLowerCase())

    let injuryType = await InjuryType.query()
      .where((query) => {
        query.where('clubId', clubId).orWhereNull('clubId')
      })
      .where('name', normalizedInjuryTypeName)
      .orderBy('id', 'asc')
      .first()

    if (!injuryType) {
      injuryType = await InjuryType.create({
        name: normalizedInjuryTypeName,
        categoryId: injuryCategory.id,
        clubId: clubId,
      })
    }

    return injuryType
  }
}
