import Day from '#models_pg/day'
import { DateTime } from 'luxon'

type DayPreload =
  | 'health'
  | 'sportActivities'
  | 'sportActivitiesWithFoodIntakes'
  | 'nutrition'
  | 'sleeps'

export default class DayService {
  async getDayByDate(date: string, athlete_id: string, preloads: DayPreload[] = []): Promise<Day> {
    const query = Day.query().where('dateOfDay', date).where('athleteId', athlete_id)

    const preloadMap: Record<DayPreload, (q: typeof query) => void> = {
      health: (q) =>
        q.preload('health', (healthQuery) => {
          healthQuery.preload('pains', (painsQuery) => {
            painsQuery.preload('location')
          })
        }),
      sportActivities: (q) =>
        q.preload('sportActivities', (activitiesQuery) => {
          activitiesQuery.preload('sport')
        }),
      sportActivitiesWithFoodIntakes: (q) =>
        q.preload('sportActivities', (activitiesQuery) => {
          activitiesQuery.preload('activityFoodIntakes', (foodIntakesQuery) => {
            foodIntakesQuery.preload('aliment')
          })
        }),
      nutrition: (q) =>
        q.preload('nutrition', (nutritionQuery) => {
          nutritionQuery.preload('aliment')
          nutritionQuery.preload('llmAliment')
          nutritionQuery.preload('recipe', (recipeQuery) => {
            recipeQuery.preload('recipeAliments', (recipeAlimentsQuery) => {
              recipeAlimentsQuery.preload('meal')
            })
          })
        }),
      sleeps: (q) => q.preload('sleeps'),
    }

    preloads.forEach((item) => {
      preloadMap[item](query)
    })

    const day = await query.first()
    if (!day) {
      throw new Error('Day not found for the given date and athlete')
    }
    return day
  }

  async getDaysByDateRange(
    athlete_id: string,
    startDate: Date | DateTime | string,
    endDate: Date | DateTime | string,
    preloads: DayPreload[] = [],
    options?: {
      orderBy?: 'asc' | 'desc'
      limit?: number
    }
  ): Promise<Day[]> {
    const startDateObj =
      startDate instanceof DateTime
        ? startDate.toJSDate()
        : typeof startDate === 'string'
          ? new Date(startDate)
          : startDate
    const endDateObj =
      endDate instanceof DateTime
        ? endDate.toJSDate()
        : typeof endDate === 'string'
          ? new Date(endDate)
          : endDate

    const query = Day.query()
      .where('athleteId', athlete_id)
      .where('dateOfDay', '>=', startDateObj)
      .where('dateOfDay', '<=', endDateObj)

    const preloadMap: Record<DayPreload, (q: typeof query) => void> = {
      health: (q) =>
        q.preload('health', (healthQuery) => {
          healthQuery.preload('pains', (painsQuery) => {
            painsQuery.preload('location')
          })
        }),
      sportActivities: (q) =>
        q.preload('sportActivities', (activitiesQuery) => {
          activitiesQuery.preload('sport')
        }),
      sportActivitiesWithFoodIntakes: (q) =>
        q.preload('sportActivities', (activitiesQuery) => {
          activitiesQuery.preload('activityFoodIntakes', (foodIntakesQuery) => {
            foodIntakesQuery.preload('aliment')
          })
        }),
      nutrition: (q) =>
        q.preload('nutrition', (nutritionQuery) => {
          nutritionQuery.preload('aliment')
          nutritionQuery.preload('llmAliment')
          nutritionQuery.preload('recipe', (recipeQuery) => {
            recipeQuery.preload('recipeAliments', (recipeAlimentsQuery) => {
              recipeAlimentsQuery.preload('meal')
            })
          })
        }),
      sleeps: (q) => q.preload('sleeps'),
    }

    preloads.forEach((item) => {
      preloadMap[item](query)
    })

    if (options?.orderBy) {
      query.orderBy('dateOfDay', options.orderBy)
    }

    if (options?.limit) {
      query.limit(options.limit)
    }

    return query
  }
}
