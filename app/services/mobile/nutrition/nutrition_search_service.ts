import Aliment from '#models_pg/aliment'
import Nutrition from '#models_pg/nutrition'
import ActivityFoodIntake from '#models_pg/activity_food_intake'
import type Athlete from '#models_pg/athlete'
import { Infer } from '@vinejs/vine/types'
import { searchNutritionSchema } from '#schemas/nutrition'
import { MIN_NUTRITION_SEARCH_LENGTH } from '#constants/nutrition.constants'
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants'
import { TranslationService } from '#services/translation_service'
import type { AppLanguage } from '#utils/localize'

const relevance = (name: string, query: string) => {
  const value = name.toLowerCase()
  const q = query.toLowerCase()
  const plain = value.replace(/,/g, '')

  if (value === q) return 0
  if (value.startsWith(`${q},`)) return 1
  if (plain.startsWith(q)) return 2
  if (plain.includes(q)) return 3
  return 4
}

export default class NutritionSearchService {
  private translationService = new TranslationService()

  async searchAliments(
    athlete: Athlete,
    payload: Infer<typeof searchNutritionSchema>,
    language: AppLanguage
  ) {
    const { search, page = 1, pageSize = 10 } = payload
    const normalized = (search?.trim() ?? '')
      .replace(/’|‘|´/g, "'")
      .replace(/œ/g, 'oe')
      .replace(/Œ/g, 'Oe')
    const terms = normalized
      .split(/\s+/)
      .filter((t) => t.length >= MIN_NUTRITION_SEARCH_LENGTH)

    if (normalized.length < MIN_NUTRITION_SEARCH_LENGTH || terms.length === 0) {
      return {
        count: 0,
        next: null,
        previous: null,
        results: [],
      }
    }

    const query = Aliment.query()
      .leftJoin('translations as t', (join) =>
        join
          .on('t.translatable_id', 'aliments.id')
          .andOnVal('t.translatable_type', TRANSLATABLE_TYPES.ALIMENT)
          .andOnVal('t.key', TRANSLATION_KEYS.ALIMENT_NAME)
          .andOnVal('t.language', language)
      )
      .select('aliments.*')
      .where((builder) =>
        builder
          .whereIn(
            'aliments.id',
            Nutrition.query()
              .whereHas('day', (q) => q.where('athleteId', athlete.id))
              .whereNotNull('alimentId')
              .select('alimentId')
          )
          .orWhereIn(
            'aliments.id',
            ActivityFoodIntake.query()
              .whereHas('sportActivity', (q) =>
                q.whereHas('day', (d) => d.where('athleteId', athlete.id))
              )
              .whereNotNull('alimentId')
              .select('alimentId')
          )
          .orWhereIn('aliments.reference_database', [
            'Ciqual',
            'OpenFoodFacts_Admin',
            'OpenFoodFacts',
          ])
          .orWhere('aliments.athlete_id', athlete.id)
      )

    terms.forEach((term) => {
      query.where((qb) => {
        qb.where('t.value', 'ilike', `%${term}%`).orWhere((customQb) => {
          customQb.where('aliments.athlete_id', athlete.id).where('aliments.name', 'ilike', `%${term}%`)
        })
      })
    })

    const rows = await query
    await this.translationService.applyTranslatedNames(
      rows.filter((aliment): aliment is Aliment & { name: string } => aliment.name != null),
      TRANSLATABLE_TYPES.ALIMENT,
      TRANSLATION_KEYS.ALIMENT_NAME,
      language
    )

    const sorted = rows.sort((a, b) => {
      const nameA = a.name ?? ''
      const nameB = b.name ?? ''
      const byRelevance = relevance(nameA, normalized) - relevance(nameB, normalized)
      return byRelevance !== 0 ? byRelevance : nameA.localeCompare(nameB)
    })

    const offset = (page - 1) * pageSize
    const lastPage = Math.max(1, Math.ceil(sorted.length / pageSize))

    return {
      count: sorted.length,
      next: page < lastPage ? page + 1 : null,
      previous: page > 1 ? page - 1 : null,
      results: sorted.slice(offset, offset + pageSize).map((item) => item.serialize()),
    }
  }
}
