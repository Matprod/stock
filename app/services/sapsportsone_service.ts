import {
  findSapQuestionMapping,
  SAPSPORTSONE_HEALTH_METRICS,
  SAPSPORTSONE_QUESTION_MAPPINGS,
  type SapSportsOneHealthMetric,
  type SapSportsOneQuestionMapping,
  type SapSportsOneQuestionTarget,
} from '#constants/sapsportsone.constants'
import {
  ATHLETE_PROVIDER_SOURCE,
  ATHLETE_PROVIDER_TYPES,
} from '#constants/athlete_provider.constants'
import type { SapSportsOneRecord, SapSportsOneServiceConfig } from '#contracts/sapsportsone'
import type { MetricDataType } from '#constants/metrics.constants'
import Athlete from '#models_pg/athlete'
import AthleteProvider from '#models_pg/athlete_provider'
import Day from '#models_pg/day'
import HealthMetric from '#models_pg/health_metric'
import HealthMetricValue from '#models_pg/health_metric_value'
import HealthRating from '#models_pg/health_rating'
import Injury from '#models_pg/injury'
import InjurySection from '#models_pg/injury_section'
import InjuryType from '#models_pg/injury_type'
import Sleep from '#models_pg/sleep'
import SportActivity from '#models_pg/sport_activity'
import {
  extractTissueAndBodyArea,
  findSectionForBodyArea,
  mapContactType,
  mapInjuryContext,
  normalizeInjuryText,
  injuriesCoincide,
  truncateString,
} from '#utils/injury_body_area'
import {
  joinInjuryText,
  inferInjuryTypeText,
  resolveSapMechanism,
  resolveTissue,
} from '#utils/injury_rules'
import env from '#start/env'
import axios, { type AxiosInstance } from 'axios'
import { DateTime } from 'luxon'

export const SAPSPORTSONE_CONFIG = {
  questPath: '/external/export/quest/v1',
  medPath: '/external/export/med/v1',
  pageSize: 500,
  timeoutMs: 180_000,
  maxRetries: 3,
  importBatchSize: 200,
} as const

export type SapSportsOneMappedAnswer = {
  personId: string
  questionId: string
  questionName: string
  answeredAt: string
  value: number
  mapping: SapSportsOneQuestionMapping
  eventAnswerId: string | null
}

export type SapSportsOneImportResult = {
  answersFetched: number
  answersMapped: number
  imported: number
  skippedNoAthlete: number
  failed: number
  errors: string[]
}

export type SapSportsOneInjuryImportResult = {
  eventsFetched: number
  injuryEvents: number
  imported: number
  skippedExisting: number
  mechanismSynced: number
  skippedNoAthlete: number
  skippedNoStart: number
  createdTypes: number
  sectionNa: number
  failed: number
  errors: string[]
}

type DedupedAnswer = SapSportsOneMappedAnswer & {
  athleteId: string
  dateOfDay: string
  resolvedTarget: Exclude<SapSportsOneQuestionTarget, { kind: 'training_rpe' }>
}

type SapApi = 'quest' | 'med'

export class SapSportsOneService {
  private readonly questClient: AxiosInstance
  private readonly medClient: AxiosInstance
  private readonly pageSize: number
  private readonly maxRetries: number
  private readonly importBatchSize: number

  constructor(config: SapSportsOneServiceConfig) {
    this.pageSize = config.pageSize ?? SAPSPORTSONE_CONFIG.pageSize
    this.maxRetries = SAPSPORTSONE_CONFIG.maxRetries
    this.importBatchSize = SAPSPORTSONE_CONFIG.importBatchSize

    const common = {
      timeout: config.timeoutMs ?? SAPSPORTSONE_CONFIG.timeoutMs,
      auth: {
        username: config.email,
        password: config.password,
      },
      headers: {
        Accept: 'application/json',
      },
    }

    const host = config.host.replace(/\/$/, '')
    this.questClient = axios.create({
      ...common,
      baseURL: `${host}${SAPSPORTSONE_CONFIG.questPath}`,
    })
    this.medClient = axios.create({
      ...common,
      baseURL: `${host}${SAPSPORTSONE_CONFIG.medPath}`,
    })
  }

  static fromEnv(): SapSportsOneService {
    const host = env.get('SAPSPORTSONE_HOST')?.trim()
    const email = env.get('SAPSPORTSONE_EMAIL')?.trim()
    const password = env.get('SAPSPORTSONE_PASSWORD')?.trim()

    if (!host || !email || !password) {
      throw new Error(
        'Missing SAPSPORTSONE_HOST, SAPSPORTSONE_EMAIL or SAPSPORTSONE_PASSWORD'
      )
    }

    return new SapSportsOneService({ host, email, password })
  }

  async fetchMedicalInjurySample(limit = 5): Promise<{
    events: SapSportsOneRecord[]
    statuses: SapSportsOneRecord[]
    persons: SapSportsOneRecord[]
  }> {
    const [events, statuses, persons] = await Promise.all([
      this.getTop('med', '/medicalEvents', limit),
      this.getTop('med', '/eventStatus', limit),
      this.getTop('med', '/playerHealthPersons', limit),
    ])
    return { events, statuses, persons }
  }

  async importMedicalInjuries(options?: {
    dryRun?: boolean
  }): Promise<SapSportsOneInjuryImportResult> {
    const dryRun = options?.dryRun ?? false
    const errors: string[] = []

    console.log('  fetching /medicalEvents...')
    const events = await this.getAll('med', '/medicalEvents')
    console.log('  fetching /eventStatus...')
    const statuses = await this.getAll('med', '/eventStatus')

    const latestStatusByEvent = new Map<string, SapSportsOneRecord>()
    for (const status of statuses) {
      const eventId = status.EventId ? String(status.EventId) : null
      if (!eventId) continue
      const changedAt = status.ChangedAt ? String(status.ChangedAt) : ''
      const existing = latestStatusByEvent.get(eventId)
      if (!existing) {
        latestStatusByEvent.set(eventId, status)
        continue
      }
      const existingChanged = existing.ChangedAt ? String(existing.ChangedAt) : ''
      if (changedAt > existingChanged) {
        latestStatusByEvent.set(eventId, status)
      }
    }

    const injuryEvents = events.filter((event) => String(event.EventType ?? '') === 'INJURY')
    const providerCache = await this.loadSapAthleteCache()

    const athleteIds = [...new Set([...providerCache.values()].map((athlete) => athlete.id))]
    const existingInjuries =
      athleteIds.length > 0
        ? await Injury.query()
            .whereIn('athleteId', athleteIds)
            .where('source', ATHLETE_PROVIDER_SOURCE.SAP)
            .preload('injuryType')
        : []
    const existingByAthlete = new Map<string, Injury[]>()
    for (const injury of existingInjuries) {
      const list = existingByAthlete.get(injury.athleteId) ?? []
      list.push(injury)
      existingByAthlete.set(injury.athleteId, list)
    }

    const sections = await InjurySection.query()
    const naSection =
      sections.find((section) => normalizeInjuryText(section.name) === 'n/a') ??
      (await InjurySection.query().whereILike('name', 'N/A').first())

    if (!naSection) {
      throw new Error('Fallback injury section "N/A" not found')
    }

    const existingTypes = await InjuryType.query()
    const injuryTypeByNameSectionClub = new Map(
      existingTypes.map((type) => [
        `${normalizeInjuryText(type.name ?? '')}::${type.categoryId}::${type.clubId ?? 'null'}`,
        type,
      ])
    )

    const resolveInjuryType = async (
      label: string,
      section: InjurySection,
      clubId: string | null
    ): Promise<{ type: InjuryType; created: boolean }> => {
      const typeName = truncateString(label)
      const key = `${normalizeInjuryText(typeName)}::${section.id}::${clubId ?? 'null'}`
      const cached = injuryTypeByNameSectionClub.get(key)
      if (cached) return { type: cached, created: false }

      if (dryRun) {
        const preview = new InjuryType()
        preview.name = typeName
        preview.categoryId = section.id
        preview.clubId = clubId
        injuryTypeByNameSectionClub.set(key, preview)
        return { type: preview, created: true }
      }

      const created = await InjuryType.create({
        name: typeName,
        categoryId: section.id,
        clubId,
      })
      injuryTypeByNameSectionClub.set(key, created)
      return { type: created, created: true }
    }

    let imported = 0
    let skippedExisting = 0
    let mechanismSynced = 0
    let skippedNoAthlete = 0
    let skippedNoStart = 0
    let createdTypes = 0
    let sectionNa = 0
    let failed = 0
    const missingAthletes = new Set<string>()

    for (const event of injuryEvents) {
      const eventId = event.EventId ? String(event.EventId) : null
      const personId = event.PersonId ? String(event.PersonId) : null
      if (!eventId || !personId) {
        failed++
        errors.push('medicalEvent missing EventId or PersonId')
        continue
      }

      const athlete = providerCache.get(personId)
      if (!athlete) {
        skippedNoAthlete++
        missingAthletes.add(personId)
        continue
      }

      const startDate = parseSapDate(event.StartDate) ?? parseSapDate(event.StartDateTime)
      if (!startDate) {
        skippedNoStart++
        errors.push(`${eventId} | missing StartDate`)
        continue
      }

      const status = latestStatusByEvent.get(eventId)
      const endDate =
        parseSapDate(event.EndDate) ??
        parseSapDate(event.EstimatedEndDate) ??
        parseSapDate(status?.EndDate) ??
        parseSapDate(status?.EstimatedReturnDate)

      const label =
        pickText(event.CategoryName) ??
        pickText(event.ShortText) ??
        pickText(event.Description) ??
        pickText(event.InjuryTypeText) ??
        'N/A'

      const pathology = truncateString(label)
      const note = pickText(event.Description) ?? pickText(status?.StatusLongText)
      const injuryTypeText = pickText(event.InjuryTypeText)
      const searchText = joinInjuryText(
        pathology,
        note,
        pickText(event.CategoryName),
        pickText(event.ShortText),
        pickText(event.Description),
        injuryTypeText
      )

      const tissue = resolveTissue(null, searchText)
      const mechanism = resolveSapMechanism(injuryTypeText, searchText)
      const { bodyArea } = extractTissueAndBodyArea(searchText || null)
      const { section, usedNa } = findSectionForBodyArea(bodyArea, sections, naSection)
      if (usedNa) sectionNa++

      const { type: injuryType, created: typeCreated } = await resolveInjuryType(
        label,
        section,
        athlete.clubId ?? null
      )
      if (typeCreated) createdTypes++

      const athleteInjuries = existingByAthlete.get(athlete.id) ?? []
      const matches = athleteInjuries.filter((injury) =>
        injuriesCoincide({
          dateA: startDate,
          dateB: injury.dateOfInjury,
          tissueA: tissue ?? bodyArea,
          tissueB: injury.tissue,
          pathologyA: pathology,
          pathologyB: injury.pathology,
          sectionIdA: section.id,
          sectionIdB: injury.injuryType?.categoryId ?? null,
        })
      )
      if (matches.length > 0) {
        const sapType = injuryTypeText?.trim() || null
        for (const injury of matches) {
          const nextMechanism = sapType
            ? sapType
            : injury.mechanism?.trim()
              ? injury.mechanism
              : inferInjuryTypeText(searchText)

          if (!nextMechanism || nextMechanism === injury.mechanism) continue

          if (!dryRun && injury.id) {
            injury.mechanism = nextMechanism
            await injury.save()
          }
          mechanismSynced++
        }
        skippedExisting++
        continue
      }

      if (!dryRun && injuryType.id) {
        try {
          const created = await Injury.create({
            athleteId: athlete.id,
            typeOfInjuryId: injuryType.id,
            dateOfInjury: startDate,
            recoveryDate: endDate,
            context: mapInjuryContext(
              event.TrainingMatchTypeText ? String(event.TrainingMatchTypeText) : null
            ),
            contactType: mapContactType(
              event.InjuryCauseText ? String(event.InjuryCauseText) : null
            ),
            note,
            mechanism,
            tissue,
            pathology,
            source: ATHLETE_PROVIDER_SOURCE.SAP,
          })
          const list = existingByAthlete.get(athlete.id) ?? []
          list.push(created)
          existingByAthlete.set(athlete.id, list)
        } catch (error) {
          failed++
          errors.push(
            `${eventId} | ${error instanceof Error ? error.message : String(error)}`
          )
          continue
        }
      } else if (dryRun && injuryType) {
        const preview = new Injury()
        preview.athleteId = athlete.id
        preview.dateOfInjury = startDate
        preview.tissue = tissue
        preview.mechanism = mechanism
        preview.pathology = pathology
        preview.note = note
        preview.typeOfInjuryId = injuryType.id || null
        const list = existingByAthlete.get(athlete.id) ?? []
        list.push(preview)
        existingByAthlete.set(athlete.id, list)
      }

      imported++
    }

    if (missingAthletes.size > 0) {
      console.log(`  missing SAP athlete providers: ${missingAthletes.size}`)
    }

    return {
      eventsFetched: events.length,
      injuryEvents: injuryEvents.length,
      imported,
      skippedExisting,
      mechanismSynced,
      skippedNoAthlete,
      skippedNoStart,
      createdTypes,
      sectionNa,
      failed,
      errors,
    }
  }

  async fetchSample(limit = 10): Promise<{
    events: SapSportsOneRecord[]
    answers: SapSportsOneRecord[]
    persons: SapSportsOneRecord[]
    questions: SapSportsOneRecord[]
  }> {
    const [events, answers, persons, questions] = await Promise.all([
      this.getTop('quest', '/questionnaireEvents', limit),
      this.getTop('quest', '/questionnaireEventAnswers', limit),
      this.getTop('quest', '/enhancedQuestionnairesPersons', limit),
      this.getTop('quest', '/questionnaireQuestions', limit),
    ])

    return { events, answers, persons, questions }
  }

  async fetchMappedAnswers(options?: {
    maxAnswers?: number
  }): Promise<{
    questions: SapSportsOneRecord[]
    mappedAnswers: SapSportsOneMappedAnswer[]
    answersFetched: number
  }> {
    const questions = await this.getAll('quest', '/questionnaireQuestions')
    const questionById = new Map<string, SapSportsOneRecord>()
    const mappedQuestionIds = new Set<string>()
    const matchedMappings = new Set<string>()

    for (const question of questions) {
      const questionId = question.QuestionId ? String(question.QuestionId) : null
      const questionName = question.Name ? String(question.Name) : null
      if (!questionId) continue

      questionById.set(questionId, question)
      const mapping = findSapQuestionMapping(questionId, questionName)
      if (mapping) {
        mappedQuestionIds.add(questionId)
        matchedMappings.add(mapping.questionName)
      }
    }

    const missing = SAPSPORTSONE_QUESTION_MAPPINGS.filter(
      (mapping) => !matchedMappings.has(mapping.questionName)
    ).map((mapping) => mapping.questionName)

    console.log(
      `  mappings matched: ${matchedMappings.size}/${SAPSPORTSONE_QUESTION_MAPPINGS.length}` +
        ` (${[...matchedMappings].join(', ') || 'none'})`
    )
    if (missing.length > 0) {
      console.log(`  mappings missing: ${missing.join(', ')}`)
    }
    console.log(`  SAP question ids matched: ${mappedQuestionIds.size}`)

    const mappedAnswers: SapSportsOneMappedAnswer[] = []
    let answersFetched = 0
    let skip = 0

    while (true) {
      const batch = await this.getPage('quest', '/questionnaireEventAnswers', skip)
      answersFetched += batch.length

      for (const answer of batch) {
        const questionId = answer.QuestionId ? String(answer.QuestionId) : null
        if (!questionId || !mappedQuestionIds.has(questionId)) continue

        const question = questionById.get(questionId)
        const questionName = question?.Name ? String(question.Name) : null
        const mapping = findSapQuestionMapping(questionId, questionName)
        if (!mapping) continue

        const personId = answer.PersonId ? String(answer.PersonId) : null
        const answeredAt = answer.AnsweredAt ? String(answer.AnsweredAt) : null
        const value = parseAnswerValue(answer.AnswerValue)
        if (!personId || !answeredAt || value === null) continue

        mappedAnswers.push({
          personId,
          questionId,
          questionName: mapping.questionName,
          answeredAt,
          value,
          mapping,
          eventAnswerId: answer.EventAnswerId ? String(answer.EventAnswerId) : null,
        })

        if (options?.maxAnswers && mappedAnswers.length >= options.maxAnswers) {
          console.log(
            `  /questionnaireEventAnswers: stopped early at ${answersFetched} fetched, ${mappedAnswers.length} mapped`
          )
          return { questions, mappedAnswers, answersFetched }
        }
      }

      console.log(
        `  /questionnaireEventAnswers: fetched ${answersFetched}, mapped ${mappedAnswers.length}`
      )

      if (batch.length < this.pageSize) break
      skip += this.pageSize
    }

    return { questions, mappedAnswers, answersFetched }
  }

  async importMappedAnswers(options?: {
    maxAnswers?: number
  }): Promise<SapSportsOneImportResult> {
    const { mappedAnswers, answersFetched } = await this.fetchMappedAnswers(options)
    const providerCache = await this.loadSapAthleteCache()
    await this.ensureHealthMetrics()
    const metricCatalog = await this.loadHealthMetricCatalog()

    const errors: string[] = []
    const missingAthletes = new Set<string>()
    let skippedNoAthlete = 0
    let failed = 0
    let imported = 0

    type PendingAnswer = SapSportsOneMappedAnswer & {
      athleteId: string
      dateOfDay: string
      answeredAtDt: DateTime
    }

    const pending: PendingAnswer[] = []
    for (const answer of mappedAnswers) {
      const athlete = providerCache.get(answer.personId)
      if (!athlete) {
        skippedNoAthlete++
        missingAthletes.add(answer.personId)
        continue
      }

      const answeredAtDt = DateTime.fromISO(answer.answeredAt, { zone: 'utc' })
      if (!answeredAtDt.isValid) {
        failed++
        errors.push(`${answer.personId} | invalid AnsweredAt ${answer.answeredAt}`)
        continue
      }

      pending.push({
        ...answer,
        athleteId: athlete.id,
        dateOfDay: answeredAtDt.toFormat('yyyy-MM-dd'),
        answeredAtDt,
      })
    }

    const trainingPending = pending.filter((row) => row.mapping.target.kind === 'training_rpe')
    const activityTimesByAthleteDate = await this.loadActivityStartTimesByAthleteDate(
      trainingPending.map((row) => ({ athleteId: row.athleteId, dateOfDay: row.dateOfDay }))
    )

    let preCount = 0
    let postCount = 0

    const latestByKey = new Map<string, DedupedAnswer>()
    for (const answer of pending) {
      const resolvedTarget = resolveAnswerTarget(
        answer.mapping.target,
        answer.athleteId,
        answer.dateOfDay,
        answer.answeredAtDt,
        activityTimesByAthleteDate
      )

      if (resolvedTarget.kind === 'health_metric') {
        if (resolvedTarget.metric === 'pre_training_rpe') preCount++
        if (resolvedTarget.metric === 'post_training_rpe') postCount++
      }

      const targetKey =
        resolvedTarget.kind === 'health_metric'
          ? `metric:${resolvedTarget.metric}`
          : `${resolvedTarget.kind}:${resolvedTarget.field}`
      const key = `${answer.athleteId}|${answer.dateOfDay}|${targetKey}`
      const existing = latestByKey.get(key)
      if (!existing || answer.answeredAt > existing.answeredAt) {
        latestByKey.set(key, {
          ...answer,
          resolvedTarget,
        })
      }
    }

    console.log(`  training RPE resolved: pre=${preCount} post=${postCount}`)

    const deduped = [...latestByKey.values()]
    const totalBatches = Math.max(1, Math.ceil(deduped.length / this.importBatchSize))

    console.log('')
    console.log(
      `── Import ${deduped.length} deduped row(s) in ${totalBatches} batch(es) of ${this.importBatchSize} ──`
    )

    for (let i = 0; i < deduped.length; i += this.importBatchSize) {
      const batch = deduped.slice(i, i + this.importBatchSize)
      const batchNumber = Math.floor(i / this.importBatchSize) + 1

      try {
        const batchImported = await this.importAnswerBatch(batch, metricCatalog)
        imported += batchImported
        console.log(
          `  [Batch ${batchNumber}/${totalBatches}] imported ${batchImported}/${batch.length} | total ${imported}`
        )
      } catch (error) {
        failed += batch.length
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`Batch ${batchNumber}: ${message}`)
        console.log(`  [Batch ${batchNumber}/${totalBatches}] FAILED — ${message}`)
      }
    }

    if (missingAthletes.size > 0) {
      errors.push(
        `Missing SAP athlete providers for ${missingAthletes.size} PersonId(s): ${[...missingAthletes].slice(0, 10).join(', ')}${missingAthletes.size > 10 ? '...' : ''}`
      )
    }

    return {
      answersFetched,
      answersMapped: mappedAnswers.length,
      imported,
      skippedNoAthlete,
      failed,
      errors,
    }
  }

  private async importAnswerBatch(
    batch: DedupedAnswer[],
    metricCatalog: Map<string, { id: string; dataType: MetricDataType }>
  ): Promise<number> {
    const athleteIds = [...new Set(batch.map((row) => row.athleteId))]
    const dates = [...new Set(batch.map((row) => row.dateOfDay))]

    const existingDays = await Day.query()
      .whereIn('athleteId', athleteIds)
      .whereIn('dateOfDay', dates)

    const dayByKey = new Map(
      existingDays.map((day) => [
        `${day.athleteId}|${day.dateOfDay.toFormat('yyyy-MM-dd')}`,
        day,
      ])
    )

    const missingDays = batch
      .map((row) => `${row.athleteId}|${row.dateOfDay}`)
      .filter((key, index, arr) => arr.indexOf(key) === index && !dayByKey.has(key))
      .map((key) => {
        const [athleteId, dateOfDay] = key.split('|')
        return {
          athleteId,
          dateOfDay: DateTime.fromISO(dateOfDay, { zone: 'utc' }),
        }
      })

    if (missingDays.length > 0) {
      await Day.updateOrCreateMany(['athleteId', 'dateOfDay'], missingDays)

      const refreshedDays = await Day.query()
        .whereIn('athleteId', athleteIds)
        .whereIn('dateOfDay', dates)

      for (const day of refreshedDays) {
        dayByKey.set(`${day.athleteId}|${day.dateOfDay.toFormat('yyyy-MM-dd')}`, day)
      }
    }

    const dayIds = [...dayByKey.values()].map((day) => day.id)
    const [existingSleeps, existingHealths] = await Promise.all([
      dayIds.length > 0 ? Sleep.query().whereIn('dayId', dayIds) : Promise.resolve([]),
      dayIds.length > 0 ? HealthRating.query().whereIn('dayId', dayIds) : Promise.resolve([]),
    ])

    const sleepByDayId = new Map(existingSleeps.map((sleep) => [sleep.dayId, sleep]))
    const healthByDayId = new Map(existingHealths.map((health) => [health.dayId, health]))

    const sleepUpdates = new Map<string, number>()
    const healthBodyUpdates = new Map<string, number>()
    const healthMoodUpdates = new Map<string, number>()
    const metricUpdates = new Map<string, Map<string, number>>()
    const daysNeedingSleep = new Set<string>()
    const daysNeedingHealth = new Set<string>()

    for (const row of batch) {
      const day = dayByKey.get(`${row.athleteId}|${row.dateOfDay}`)
      if (!day) continue

      const target = row.resolvedTarget
      if (target.kind === 'sleep') {
        daysNeedingSleep.add(day.id)
        sleepUpdates.set(day.id, row.value)
      } else if (target.kind === 'health_rating') {
        daysNeedingHealth.add(day.id)
        if (target.field === 'bodySorenessRating') {
          healthBodyUpdates.set(day.id, row.value)
        } else {
          healthMoodUpdates.set(day.id, row.value)
        }
      } else {
        daysNeedingHealth.add(day.id)
        const metrics = metricUpdates.get(day.id) ?? new Map<string, number>()
        metrics.set(target.metric, row.value)
        metricUpdates.set(day.id, metrics)
      }
    }

    const sleepsToCreate = [...daysNeedingSleep]
      .filter((dayId) => !sleepByDayId.has(dayId))
      .map((dayId) => ({
        dayId,
        dataSource: 'sap' as const,
        qualityRating: sleepUpdates.get(dayId) ?? null,
      }))

    if (sleepsToCreate.length > 0) {
      const created = await Sleep.createMany(sleepsToCreate)
      for (const sleep of created) {
        sleepByDayId.set(sleep.dayId, sleep)
      }
    }

    const healthsToCreate = [...daysNeedingHealth]
      .filter((dayId) => !healthByDayId.has(dayId))
      .map((dayId) => ({
        dayId,
        bodySorenessRating: healthBodyUpdates.get(dayId) ?? null,
        moodRating: healthMoodUpdates.get(dayId) ?? null,
      }))

    if (healthsToCreate.length > 0) {
      const created = await HealthRating.createMany(healthsToCreate)
      for (const health of created) {
        healthByDayId.set(health.dayId, health)
      }
    }

    const sleepModelsToUpdate = [...sleepUpdates.entries()]
      .map(([dayId, qualityRating]) => {
        const sleep = sleepByDayId.get(dayId)
        if (!sleep) return null
        sleep.qualityRating = qualityRating
        sleep.dataSource = 'sap'
        return sleep
      })
      .filter((sleep): sleep is Sleep => sleep !== null)

    if (sleepModelsToUpdate.length > 0) {
      await Promise.all(sleepModelsToUpdate.map((sleep) => sleep.save()))
    }

    const healthModelsToUpdate = [
      ...new Set([...healthBodyUpdates.keys(), ...healthMoodUpdates.keys()]),
    ]
      .map((dayId) => {
        const health = healthByDayId.get(dayId)
        if (!health) return null
        if (healthBodyUpdates.has(dayId)) {
          health.bodySorenessRating = healthBodyUpdates.get(dayId)!
        }
        if (healthMoodUpdates.has(dayId)) {
          health.moodRating = healthMoodUpdates.get(dayId)!
        }
        return health
      })
      .filter((health): health is HealthRating => health !== null)

    if (healthModelsToUpdate.length > 0) {
      await Promise.all(healthModelsToUpdate.map((health) => health.save()))
    }

    const metricEntries: Array<{ healthId: string; metricId: string; value: string }> = []
    for (const [dayId, metrics] of metricUpdates) {
      const health = healthByDayId.get(dayId)
      if (!health) continue
      for (const [metricName, value] of metrics) {
        const metric = metricCatalog.get(metricName)
        if (!metric) continue
        metricEntries.push({
          healthId: health.id,
          metricId: metric.id,
          value: String(value),
        })
      }
    }

    if (metricEntries.length > 0) {
      await HealthMetricValue.updateOrCreateMany(['healthId', 'metricId'], metricEntries)
    }

    return batch.length
  }

  private async loadActivityStartTimesByAthleteDate(
    keys: Array<{ athleteId: string; dateOfDay: string }>
  ): Promise<Map<string, DateTime[]>> {
    const result = new Map<string, DateTime[]>()
    if (keys.length === 0) return result

    const athleteIds = [...new Set(keys.map((key) => key.athleteId))]
    const dates = [...new Set(keys.map((key) => key.dateOfDay))]

    const days = await Day.query().whereIn('athleteId', athleteIds).whereIn('dateOfDay', dates)
    if (days.length === 0) return result

    const dayKeyById = new Map(
      days.map((day) => [
        day.id,
        `${day.athleteId}|${day.dateOfDay.toFormat('yyyy-MM-dd')}`,
      ])
    )

    const activities = await SportActivity.query()
      .whereIn(
        'dayId',
        days.map((day) => day.id)
      )
      .whereNotNull('timeOfActivity')

    for (const activity of activities) {
      const athleteDateKey = dayKeyById.get(activity.dayId)
      if (!athleteDateKey || !activity.timeOfActivity) continue

      const [, dateOfDay] = athleteDateKey.split('|')
      const start = parseActivityStart(dateOfDay, activity.timeOfActivity)
      if (!start) continue

      const existing = result.get(athleteDateKey) ?? []
      existing.push(start)
      result.set(athleteDateKey, existing)
    }

    return result
  }

  private async ensureHealthMetrics(): Promise<void> {
    for (const name of SAPSPORTSONE_HEALTH_METRICS) {
      await HealthMetric.firstOrCreate(
        { name },
        {
          name,
          description: `SAP SportsOne ${name}`,
          unit: name === 'injury_status' ? 'boolean' : 'score',
          dataType: 'integer',
        }
      )
    }
  }

  private async loadHealthMetricCatalog(): Promise<
    Map<string, { id: string; dataType: MetricDataType }>
  > {
    const metrics = await HealthMetric.query().whereIn('name', [...SAPSPORTSONE_HEALTH_METRICS])
    return new Map(
      metrics.map((metric) => [metric.name, { id: metric.id, dataType: metric.dataType }])
    )
  }

  private async loadSapAthleteCache(): Promise<Map<string, Athlete>> {
    const providers = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
      .whereNotNull('providerAthleteId')
      .preload('athlete')

    return new Map(
      providers
        .filter((provider) => provider.providerAthleteId && provider.athlete)
        .map((provider) => [provider.providerAthleteId!, provider.athlete])
    )
  }

  private async getAll(api: SapApi, path: string): Promise<SapSportsOneRecord[]> {
    const results: SapSportsOneRecord[] = []
    let skip = 0

    while (true) {
      const batch = await this.getPage(api, path, skip)
      results.push(...batch)

      if (batch.length < this.pageSize) {
        console.log(`  ${api}${path}: ${results.length} row(s)`)
        return results
      }

      skip += this.pageSize
      if (skip % (this.pageSize * 5) === 0) {
        console.log(`  ${api}${path}: ${results.length} row(s) so far...`)
      }
    }
  }

  private async getTop(api: SapApi, path: string, top: number): Promise<SapSportsOneRecord[]> {
    return this.getPage(api, path, 0, top)
  }

  private async getPage(
    api: SapApi,
    path: string,
    skip: number,
    top = this.pageSize
  ): Promise<SapSportsOneRecord[]> {
    const client = api === 'med' ? this.medClient : this.questClient
    let attempt = 0

    while (true) {
      try {
        const response = await client.get(path, {
          params: {
            $top: top,
            $skip: skip,
          },
        })

        const value = response.data?.value
        if (!Array.isArray(value)) return []
        return value.filter(
          (item): item is SapSportsOneRecord => typeof item === 'object' && item !== null
        )
      } catch (error) {
        attempt++
        const retryable =
          axios.isAxiosError(error) &&
          (error.code === 'ECONNABORTED' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNRESET' ||
            error.message.includes('socket hang up') ||
            (error.response?.status !== undefined && error.response.status >= 500))

        if (!retryable || attempt >= this.maxRetries) {
          throw error
        }

        const waitMs = 5_000 * 2 ** (attempt - 1)
        console.log(
          `  WARN ${api}${path} (skip=${skip}): retry ${attempt}/${this.maxRetries} in ${waitMs / 1000}s`
        )
        await new Promise((resolve) => setTimeout(resolve, waitMs))
      }
    }
  }
}

function parseAnswerValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function parseActivityStart(dateOfDay: string, timeOfActivity: string): DateTime | null {
  const time = timeOfActivity.trim()
  // Missing / placeholder kickoff (NULL often stored as 00:00:00) must not count as a real start
  if (!time || time === '00:00:00' || time === '0:00:00' || time === '00:00') {
    return null
  }

  const iso = DateTime.fromISO(`${dateOfDay}T${time}`, { zone: 'utc' })
  if (iso.isValid) return iso

  const sql = DateTime.fromSQL(`${dateOfDay} ${time}`, { zone: 'utc' })
  return sql.isValid ? sql : null
}

function resolveAnswerTarget(
  target: SapSportsOneQuestionTarget,
  athleteId: string,
  dateOfDay: string,
  answeredAt: DateTime,
  activityTimesByAthleteDate: Map<string, DateTime[]>
): Exclude<SapSportsOneQuestionTarget, { kind: 'training_rpe' }> {
  if (target.kind !== 'training_rpe') return target

  const starts = activityTimesByAthleteDate.get(`${athleteId}|${dateOfDay}`) ?? []
  const hasActivityBefore = starts.some((start) => start < answeredAt)
  const metric: SapSportsOneHealthMetric = hasActivityBefore
    ? 'post_training_rpe'
    : 'pre_training_rpe'

  return { kind: 'health_metric', metric }
}

function pickText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function parseSapDate(value: unknown): DateTime | null {
  if (value === null || value === undefined || value === '') return null
  const text = String(value).trim()
  if (!text) return null

  const fromIso = DateTime.fromISO(text, { zone: 'utc' })
  if (fromIso.isValid) return fromIso.startOf('day')

  const fromSql = DateTime.fromSQL(text, { zone: 'utc' })
  if (fromSql.isValid) return fromSql.startOf('day')

  return null
}
