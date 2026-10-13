import Athlete from '#models_pg/athlete'
import Biomarker from '#models_pg/biomarker'
import BiomarkerType from '#models_pg/biomarker_type'
import {
  biomarkerIdParams,
  createBiomarkersSchema,
  updateBiomarkerSchema,
} from '#schemas/biomarker'
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants'
import { TranslationService } from '#services/translation_service'
import type {
  CursorPaginatedBiomarkers,
  FilterBiomarkersPayload,
  BiomarkerTrendPoint,
  BiomarkerTrendResponse,
} from '#contracts/biomarker'
import { type AppLanguage } from '#utils/localize'
import { Infer } from '@vinejs/vine/types'
import { DateTime } from 'luxon'

const BIOMARKERS_CURSOR_PAGE_SIZE = 20

export default class BiomarkerService {
  private translationService: TranslationService

  constructor() {
    this.translationService = new TranslationService()
  }

  async getBiomarkerTypes(clubId: string, language: AppLanguage) {
    const biomarkerTypes = await BiomarkerType.query()
      .where((query) => {
        query.doesntHave('clubs').orWhereHas('clubs', (clubQuery) => {
          clubQuery.where('clubs.id', clubId)
        })
      })
      .orderBy('name', 'asc')

    this.applyBiomarkerTypeDisplayNames(biomarkerTypes)
    await this.applyBiomarkerTypeTranslations(biomarkerTypes, language)
    return biomarkerTypes
  }

  async getBiomarkersByClub(
    clubId: string,
    language: AppLanguage,
    filters?: FilterBiomarkersPayload,
    seasonStartDate?: DateTime | null,
    seasonEndDate?: DateTime | null
  ): Promise<CursorPaginatedBiomarkers> {
    const biomarkersQuery = Biomarker.query()
      .whereHas('athlete', (athleteQuery) => {
        athleteQuery.where('clubId', clubId)

        if (seasonStartDate && seasonEndDate) {
          const seasonStart = seasonStartDate.toJSDate()
          const seasonEnd = seasonEndDate.toJSDate()

          athleteQuery
            .where((query) => {
              query.whereNull('startDate').orWhere('startDate', '<=', seasonEnd)
            })
            .where((query) => {
              query.whereNull('endDate').orWhere('endDate', '>=', seasonStart)
            })
        }
      })
      .orderBy('measuredAt', 'desc')
      .orderBy('id', 'desc')
      .limit(BIOMARKERS_CURSOR_PAGE_SIZE)
      .offset(filters?.cursor ?? 0)
      .preload('biomarkerType')
      .preload('athlete', (athleteQuery) => {
        athleteQuery.select('id', 'firstName', 'lastName').preload('profilePicture')
      })

    if (filters?.athleteIds?.length) {
      biomarkersQuery.whereIn('athleteId', filters.athleteIds)
    }

    if (filters?.biomarkerTypeId) {
      biomarkersQuery.where('biomarkerTypeId', filters.biomarkerTypeId)
    }

    this.applyMeasuredAtBounds(biomarkersQuery, {
      from: filters?.from,
      to: filters?.to,
      seasonStartDate,
      seasonEndDate,
    })

    const biomarkers = await biomarkersQuery

    this.applyBiomarkerTypeDisplayNames(
      biomarkers.map((biomarker) => biomarker.biomarkerType).filter(Boolean)
    )
    await this.applyBiomarkerTypeTranslations(
      biomarkers.map((biomarker) => biomarker.biomarkerType).filter(Boolean),
      language
    )

    const currentOffset = filters?.cursor ?? 0
    const nextCursor =
      biomarkers.length === BIOMARKERS_CURSOR_PAGE_SIZE
        ? currentOffset + BIOMARKERS_CURSOR_PAGE_SIZE
        : null

    return {
      data: biomarkers,
      meta: { nextCursor },
    }
  }

  async updateBiomarker({
    id,
    athleteId,
    biomarkerTypeId,
    value,
    measuredAt,
    clubId,
    language,
  }: Infer<typeof updateBiomarkerSchema> &
    Infer<typeof biomarkerIdParams> & { clubId: string; language: AppLanguage }) {
    const athlete = await Athlete.query().where('id', athleteId).where('clubId', clubId).first()

    if (!athlete) {
      throw new Error('Athlete not found')
    }

    const biomarkerType = await BiomarkerType.query()
      .where('id', biomarkerTypeId)
      .where((query) => {
        query.doesntHave('clubs').orWhereHas('clubs', (clubQuery) => {
          clubQuery.where('clubs.id', clubId)
        })
      })
      .first()

    if (!biomarkerType) {
      throw new Error('Biomarker type not found')
    }

    const biomarker = await Biomarker.query()
      .where('id', id)
      .whereHas('athlete', (athleteQuery) => {
        athleteQuery.where('clubId', clubId)
      })
      .first()

    if (!biomarker) {
      throw new Error('Biomarker not found')
    }

    biomarker.merge({
      athleteId,
      biomarkerTypeId,
      value,
      measuredAt: DateTime.fromJSDate(measuredAt),
    })
    await biomarker.save()

    await biomarker.load('biomarkerType')
    this.applyBiomarkerTypeDisplayNames([biomarker.biomarkerType])
    await this.applyBiomarkerTypeTranslations([biomarker.biomarkerType], language)
    return biomarker
  }

  async createBiomarkers({
    biomarkers,
    clubId,
  }: {
    biomarkers: Infer<typeof createBiomarkersSchema>
    clubId: string
  }) {
    const athleteIds = [...new Set(biomarkers.map((biomarker) => biomarker.athleteId))]
    const biomarkerTypeIds = [...new Set(biomarkers.map((biomarker) => biomarker.biomarkerTypeId))]

    const athletes = await Athlete.query().whereIn('id', athleteIds).where('clubId', clubId)
    if (athletes.length !== athleteIds.length) {
      throw new Error('Athlete not found')
    }

    const biomarkerTypes = await BiomarkerType.query()
      .whereIn('id', biomarkerTypeIds)
      .where((query) => {
        query.doesntHave('clubs').orWhereHas('clubs', (clubQuery) => {
          clubQuery.where('clubs.id', clubId)
        })
      })

    if (biomarkerTypes.length !== biomarkerTypeIds.length) {
      throw new Error('Biomarker type not found')
    }

    const created = await Biomarker.createMany(
      biomarkers.map((biomarker) => ({
        athleteId: biomarker.athleteId,
        biomarkerTypeId: biomarker.biomarkerTypeId,
        value: biomarker.value,
        measuredAt: DateTime.fromJSDate(biomarker.measuredAt),
      }))
    )
    return { count: created.length }
  }

  async deleteBiomarker(id: string, clubId: string) {
    const biomarker = await Biomarker.query()
      .where('id', id)
      .whereHas('athlete', (athleteQuery) => {
        athleteQuery.where('clubId', clubId)
      })
      .first()

    if (!biomarker) {
      throw new Error('Biomarker not found')
    }

    await biomarker.delete()
    return { success: true }
  }

  async getTrend(
    clubId: string,
    athleteIds: string[],
    biomarkerTypeId: string,
    language: AppLanguage,
    seasonStartDate?: DateTime | null,
    seasonEndDate?: DateTime | null
  ): Promise<BiomarkerTrendResponse | null> {
    const uniqueAthleteIds = [...new Set(athleteIds)]

    const athletes = await Athlete.query().where('clubId', clubId).whereIn('id', uniqueAthleteIds)
    if (athletes.length !== uniqueAthleteIds.length) {
      return null
    }

    const biomarkerType = await BiomarkerType.query()
      .where('id', biomarkerTypeId)
      .where((query) => {
        query.doesntHave('clubs').orWhereHas('clubs', (clubQuery) => {
          clubQuery.where('clubs.id', clubId)
        })
      })
      .first()

    if (!biomarkerType) {
      return null
    }

    this.applyBiomarkerTypeDisplayNames([biomarkerType])
    await this.applyBiomarkerTypeTranslations([biomarkerType], language)

    const rowsQuery = Biomarker.query()
      .whereIn('athleteId', uniqueAthleteIds)
      .where('biomarkerTypeId', biomarkerTypeId)
      .whereHas('athlete', (athleteQuery) => {
        athleteQuery.where('clubId', clubId)
      })
      .orderBy('athleteId', 'asc')
      .orderBy('measuredAt', 'asc')
      .orderBy('id', 'asc')

    this.applyMeasuredAtBounds(rowsQuery, { seasonStartDate, seasonEndDate })

    const rows = await rowsQuery

    const pointsByAthlete = new Map<string, BiomarkerTrendPoint[]>()
    for (const athleteId of uniqueAthleteIds) {
      pointsByAthlete.set(athleteId, [])
    }

    //TODO Align biomarkers to date-only (YYYY-MM-DD) like notes/injuries
    for (const row of rows) {
      const date = row.measuredAt?.toISO?.() ?? null
      const value = Number(row.value)
      if (!date || !Number.isFinite(value)) continue
      pointsByAthlete.get(row.athleteId)?.push({ date, value })
    }

    return {
      data: {
        biomarkerTypeId,
        biomarkerTypeName: biomarkerType.name,
        unit: biomarkerType.unit,
        athletes: uniqueAthleteIds.map((athleteId) => ({
          athleteId,
          points: pointsByAthlete.get(athleteId) ?? [],
        })),
      },
    }
  }

  private applyMeasuredAtBounds(
    query: { where: (column: string, operator: string, value: Date) => unknown },
    bounds: {
      from?: string
      to?: string
      seasonStartDate?: DateTime | null
      seasonEndDate?: DateTime | null
    }
  ) {
    if (bounds.seasonStartDate) {
      query.where('measuredAt', '>=', bounds.seasonStartDate.startOf('day').toJSDate())
    }
    if (bounds.seasonEndDate) {
      query.where('measuredAt', '<=', bounds.seasonEndDate.endOf('day').toJSDate())
    }
    if (bounds.from) {
      const fromDate = DateTime.fromISO(bounds.from).startOf('day')
      if (fromDate.isValid) {
        query.where('measuredAt', '>=', fromDate.toJSDate())
      }
    }
    if (bounds.to) {
      const toDate = DateTime.fromISO(bounds.to).endOf('day')
      if (toDate.isValid) {
        query.where('measuredAt', '<=', toDate.toJSDate())
      }
    }
  }

  private applyBiomarkerTypeDisplayNames(biomarkerTypes: BiomarkerType[]) {
    for (const type of biomarkerTypes) {
      const label = type.displayName?.trim()
      if (label) type.name = label
    }
  }

  private async applyBiomarkerTypeTranslations(
    biomarkerTypes: BiomarkerType[],
    language: AppLanguage
  ) {
    await this.translationService.applyTranslatedNames(
      biomarkerTypes,
      TRANSLATABLE_TYPES.BIOMARKER_TYPE,
      TRANSLATION_KEYS.BIOMARKER_TYPE_NAME,
      language
    )
  }
}
