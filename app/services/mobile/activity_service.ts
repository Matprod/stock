import Activity from '#models_pg/activity'
import BlackListActivity from '#models_pg/black_list_activity'
import ReinforcementExercise from '#models_pg/reinforcement_exercise'
import SportActivity from '#models_pg/sport_activity'
import AthleteService from '#services/athlete_service'
import { DateTime } from 'luxon'
import { updateActivitySchema } from '#schemas/mobile/activity'
import { Infer } from '@vinejs/vine/types'
import { parseDurationToMicroseconds } from '../../utils/time.js'
import { SportActivityService } from '#services/sport_activity_service'
import Period from '#models_pg/period'
import { MetricDomain } from '#contracts/metric'
import { MetricService } from '#services/metric_service'

export interface SportActivitiesUtilitiesResult {
  activities: Activity[]
  reinforcementExercises: ReinforcementExercise[]
}

export default class ActivityService {
  private athleteService: AthleteService
  private sportActivityService: SportActivityService
  private periodMetricService = new MetricService(MetricDomain.PERIOD)

  constructor() {
    this.athleteService = new AthleteService()
    this.sportActivityService = new SportActivityService()
  }

  public async createActivity(
    athleteId: string,
    dateOfDay: Date,
    activityTypeId: string
  ): Promise<SportActivity> {
    const activityType = await Activity.find(activityTypeId)
    if (!activityType) {
      throw new Error('Activity type not found')
    }

    const dateTime = DateTime.fromJSDate(dateOfDay)
    const day = await this.athleteService.getOrCreateDay(athleteId, dateTime)

    const sportActivity = await SportActivity.create({
      dayId: day.id,
      activityTypeId: activityTypeId,
      dataSource: 'manual',
      timeOfActivity: DateTime.now().toFormat('HH:mm:ss'),
    })

    await sportActivity.refresh()

    return sportActivity
  }

  public async getSportActivitiesUtilities(
    clubId: string | null
  ): Promise<SportActivitiesUtilitiesResult> {
    const activitiesQuery = Activity.query()
      .preload('activityDisplayVariables', (query) => {
        query
          .where((clubQuery) => {
            clubQuery.whereNull('clubId')
            if (clubId) {
              clubQuery.orWhere('clubId', clubId)
            }
          })
          .preload('displayVariable')
      })
      .orderBy('name')

    if (clubId) {
      const blacklistedIdsQuery = BlackListActivity.query()
        .where('clubId', clubId)
        .select('activityId')

      activitiesQuery.whereNotIn('id', blacklistedIdsQuery)
    }

    const activities = await activitiesQuery

    const reinforcementExercises = await ReinforcementExercise.query()
      .if(clubId !== null, (query) => {
        query.where('clubId', clubId!)
      })
      .orderBy('name')

    return {
      activities,
      reinforcementExercises,
    }
  }

  public async getActivities(athleteId: string, dateOfDay: Date): Promise<SportActivity[]> {
    const dateTime = DateTime.fromJSDate(dateOfDay)
    const day = await this.athleteService.getOrCreateDay(athleteId, dateTime)
    return SportActivity.query()
      .where('dayId', day.id)
      .preload('exerciseSets')
      .preload('sportActivityPains')
  }

  public async getActivity(athleteId: string, id: string): Promise<SportActivity> {
    return SportActivity.query()
      .where('id', id)
      .whereHas('day', (query) => {
        query.where('athleteId', athleteId)
      })
      .preload('exerciseSets')
      .preload('sportActivityPains')
      .firstOrFail()
  }

  public async updateActivity(
    athleteId: string,
    id: string,
    payload: Infer<typeof updateActivitySchema>
  ): Promise<SportActivity> {
    const activity = await SportActivity.query()
      .where('id', id)
      .whereHas('day', (query) => {
        query.where('athleteId', athleteId)
      })
      .preload('exerciseSets')
      .preload('sportActivityPains')
      .first()
    if (!activity) {
      throw new Error('Activity not found')
    }

    const { exerciseSets, carriedWeight, weaponWeight, burstCount, duration, speed, ...rest } =
      payload

    const updates: Record<string, unknown> = { ...rest }
    if (duration !== undefined) {
      updates.durationSeconds = duration
        ? Math.round(parseDurationToMicroseconds(duration) / 1_000_000)
        : null
    }
    if (speed !== undefined) {
      updates.speed = speed != null && speed !== '' ? Number(speed) : null
    }

    activity.merge(updates)

    if (exerciseSets) {
      const existingSets = new Map<string, (typeof activity.exerciseSets)[number]>()
      for (const set of activity.exerciseSets) {
        if (set.id) {
          existingSets.set(set.id, set)
        }
      }

      const updatedSetIds = new Set<string>()
      const setOperations: Promise<unknown>[] = []

      for (const exerciseSetData of exerciseSets) {
        const exerciseSetId = exerciseSetData.id
        if (exerciseSetId && existingSets.has(exerciseSetId)) {
          const existingSet = existingSets.get(exerciseSetId)!
          existingSet.merge({
            exerciseId: exerciseSetData.exerciseId,
            reps: exerciseSetData.reps ?? null,
            weight: exerciseSetData.weight ?? null,
            durationSeconds: exerciseSetData.durationSeconds ?? null,
          })
          setOperations.push(existingSet.save())
          updatedSetIds.add(exerciseSetId)
        } else {
          setOperations.push(
            activity.related('exerciseSets').create({
              exerciseId: exerciseSetData.exerciseId,
              reps: exerciseSetData.reps ?? null,
              weight: exerciseSetData.weight ?? null,
              durationSeconds: exerciseSetData.durationSeconds ?? null,
            })
          )
        }
      }

      if (setOperations.length > 0) {
        await Promise.all(setOperations)
      }

      const setsToDelete = activity.exerciseSets
        .filter((set) => set.id && !updatedSetIds.has(set.id))
        .map((set) => set.id!)

      if (setsToDelete.length > 0) {
        await activity.related('exerciseSets').query().whereIn('id', setsToDelete).delete()
      }
    }

    await activity.save()

    let period = await Period.query().where('sportActivityId', activity.id).first()
    if (!period) {
      period = await Period.create({
        sportActivityId: activity.id,
        name: 'Manual Activity',
      })
    }
    await this.periodMetricService.updateMetrics(period.id, {
      carried_weight: carriedWeight,
      weapon_weight: weaponWeight,
      burst_count: burstCount,
    })

    await this.sportActivityService.calculateTrainingLoad(activity.id, true)

    await activity.load('exerciseSets')
    await activity.refresh()
    return activity
  }

  public async deleteActivity(athleteId: string, id: string): Promise<void> {
    const activity = await SportActivity.query()
      .where('id', id)
      .whereHas('day', (query) => {
        query.where('athleteId', athleteId)
      })
      .first()
    if (!activity) {
      throw new Error('Activity not found')
    }
    await activity.related('exerciseSets').query().delete()
    await activity.related('sportActivityPains').query().delete()
    await activity.delete()
  }
}
