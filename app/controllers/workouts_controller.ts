import type { HttpContext } from '@adonisjs/core/http'
import { WorkoutService } from '#services/workout_service'
import {
  createWorkoutSchema,
  deleteWorkoutSchema,
  filterWorkoutsLibrarySchema,
  filterWorkoutsSchema,
  toggleExerciseFavoriteBodySchema,
  toggleExerciseFavoriteParamsSchema,
  startWorkoutSchema,
} from '#schemas/workout'
import SeasonService from '#services/season_service'
import { DateTime } from 'luxon'
import Event from '#models_pg/event'
import type { FilterWorkoutsPayload } from '#contracts/workout'
import { NoteService } from '#services/note_service'
export default class WorkoutsController {
  private readonly workoutService: WorkoutService
  private readonly noteService: NoteService
  private readonly seasonService: SeasonService

  constructor() {
    this.workoutService = new WorkoutService()
    this.noteService = new NoteService()
    this.seasonService = new SeasonService()
  }

  public async getAllWorkoutExercices(ctx: HttpContext) {
    const { clubId, id: userId } = ctx.auth.user!

    const exercices = await this.workoutService.getAllWorkoutExercices(clubId, userId)
    return ctx.response.json(exercices)
  }

  public async toggleExerciseFavorite({ request, response, auth }: HttpContext) {
    const { clubId, id: userId } = auth.user!
    const { exerciseId } = await toggleExerciseFavoriteParamsSchema.validate(request.params())
    const { favorite } = await toggleExerciseFavoriteBodySchema.validate(request.body())
    const exercise = await this.workoutService.toggleExerciseFavorite(
      userId,
      clubId,
      exerciseId,
      favorite
    )
    return response.json(exercise)
  }

  public async getAllWorkouts(ctx: HttpContext) {
    const clubId = ctx.auth.user?.clubId
    if (!clubId) {
      return ctx.response.badRequest({ message: 'Club not found' })
    }

    const filters = await filterWorkoutsLibrarySchema.validate(ctx.request.qs())

    const workouts = await this.workoutService.getAllWorkouts(clubId, filters)
    return ctx.response.json(workouts)
  }

  public async createWorkout({ request, response, auth }: HttpContext) {
    const payload = await createWorkoutSchema.validate(request.body())

    const clubId = auth.user?.clubId
    if (!clubId) {
      return response.badRequest({ message: 'Club not found' })
    }

    try {
      const workout = await this.workoutService.createWorkout({ ...payload, clubId })
      return response.json(workout)
    } catch (error) {
      if (error instanceof Error && error.message === 'WORKOUT_NAME_ALREADY_EXISTS') {
        return response.conflict({
          code: 'WORKOUT_NAME_ALREADY_EXISTS',
          message: 'A workout with this name already exists for this club.',
        })
      }
      throw error
    }
  }

  public async startWorkout({ request, response, auth }: HttpContext) {
    const payload = await startWorkoutSchema.validate(request.body())

    const clubId = auth.user?.clubId
    if (!clubId) {
      return response.badRequest({ message: 'Club not found' })
    }

    const { notes, ...rest } = payload

    try {
      const workout = await this.workoutService.startWorkout({ ...rest, clubId })
      const startISODate = DateTime.fromISO(rest.startTime).toISODate()
      // const nowISODate = DateTime.now().toISODate()

      if (!startISODate) {
        return response.badRequest({ message: 'Start time is not valid' })
      }

      const event = await Event.query()
        .whereHas('sportActivities', (query) => {
          query.where('workout_session_instance_id', workout.id)
        })
        .preload('eventType')
        .preload('sportActivities', (query) => {
          query.preload('day', (dayQuery) => {
            dayQuery.preload('athlete')
          })
        })
        .firstOrFail()

      if (notes && notes.length > 0) {
        await Promise.all(
          notes.map(async (note) => {
            this.noteService.createNoteForAthlete({
              ...note,
              eventId: event.id,
            })
          })
        )
      }

      return response.json(event)
    } catch (error) {
      return response.badRequest({ message: 'Error starting workout' })
    }
  }

  public async deleteWorkout({ params, response, auth }: HttpContext) {
    const { workoutId } = await deleteWorkoutSchema.validate(params)

    const clubId = auth.user?.clubId
    if (!clubId) {
      return response.badRequest({ message: 'Club not found' })
    }

    await this.workoutService.deleteWorkout({ workoutId, clubId })
    return response.ok({ message: 'Workout deleted' })
  }

  public async getWorkoutsHistory({ response, auth, request }: HttpContext) {
    const workoutsPayload: FilterWorkoutsPayload = await filterWorkoutsSchema.validate(request.qs())

    const clubId = auth.user?.clubId
    if (!clubId) {
      return response.badRequest({ message: 'Club not found' })
    }

    const seasonInfo = await this.seasonService.getSeasonFromRequest(request, clubId)
    const workouts = await this.workoutService.getWorkoutsHistory(
      clubId,
      seasonInfo.seasonStartDate,
      seasonInfo.seasonEndDate,
      workoutsPayload
    )

    return response.json(workouts)
  }
}
