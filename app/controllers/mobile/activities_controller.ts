import type { HttpContext } from '@adonisjs/core/http'
import ActivityService from '#services/mobile/activity_service'
import {
  addActivityQuerySchema,
  addActivitySchema,
  deleteActivityParamsSchema,
  getActivitiesQuerySchema,
  getActivityParamsSchema,
  updateActivityParamsSchema,
  updateActivitySchema,
} from '#schemas/mobile/activity'
import { presentActivitiesDisplayVariables } from '#utils/get_activity_variable'
import AthleteService from '#services/athlete_service'
import { SportActivityService } from '#services/sport_activity_service'
import { SubjectiveScaleService } from '#services/subjective_scale_service'
import { SubjectiveScaleValuesService } from '#services/subjective_scale_values_service'
import { extractSportActivitySubjectivePatch } from '#utils/mobile_subjective_activity_payload'
import { getLanguageFromRequest } from '#utils/language'

export default class ActivitiesController {
  private activityService: ActivityService
  private athleteService: AthleteService
  private sportActivityService: SportActivityService
  private subjectiveScaleService: SubjectiveScaleService
  private subjectiveScaleValuesService: SubjectiveScaleValuesService

  constructor() {
    this.activityService = new ActivityService()
    this.athleteService = new AthleteService()
    this.sportActivityService = new SportActivityService()
    this.subjectiveScaleService = new SubjectiveScaleService()
    this.subjectiveScaleValuesService = new SubjectiveScaleValuesService()
  }

  public async createActivity({ response, athlete, request }: HttpContext) {
    try {
      const { activityTypeId } = await addActivitySchema.validate(request.body())
      const { dateOfDay } = await addActivityQuerySchema.validate(request.qs())

      const activity = await this.activityService.createActivity(
        athlete!.athleteid,
        dateOfDay,
        activityTypeId
      )

      return response.json(activity.serialize())
    } catch (error) {
      if (error instanceof Error && error.message === 'Activity type not found') {
        return response.notFound({ message: error.message })
      }
      throw error
    }
  }

  public async getSportActivitiesUtilities({ response, athlete }: HttpContext) {
    const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)

    if (!athleteRecord) {
      return response.notFound({ message: 'Athlete not found' })
    }

    const { activities, reinforcementExercises } =
      await this.activityService.getSportActivitiesUtilities(athleteRecord.clubId)

    const displayVariablesByActivity = await presentActivitiesDisplayVariables(
      activities,
      athleteRecord.appLanguageOrDefault,
      athleteRecord.clubId
    )

    return response.json({
      activities: activities.map((activity, index) => ({
        ...activity.serialize(),
        activityDisplayVariables: displayVariablesByActivity[index].map((variable) =>
          variable.serialize()
        ),
      })),
      reinforcementExercices: reinforcementExercises.map((exercise) => exercise.serialize()),
    })
  }

  public async getActivities({ response, athlete, request }: HttpContext) {
    const { dateOfDay } = await getActivitiesQuerySchema.validate(request.qs())
    const activities = await this.activityService.getActivities(athlete!.athleteid, dateOfDay)
    return response.json(activities.map((activity) => activity.serialize()))
  }

  public async getActivity({ response, athlete, request }: HttpContext) {
    const { id } = await getActivityParamsSchema.validate(request.params())
    const activity = await this.activityService.getActivity(athlete!.athleteid, id)
    return response.json(activity.serialize())
  }

  public async updateActivity({ response, athlete, request }: HttpContext) {
    const { id } = await updateActivityParamsSchema.validate(request.params())
    const payload = await updateActivitySchema.validate(request.body())
    const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
    const language = getLanguageFromRequest(request)
    const clubScales = athleteRecord?.clubId
      ? await this.subjectiveScaleService.getScales(athleteRecord.clubId, language)
      : []
    const body = request.body() as Record<string, unknown>
    const { patch: subjectivePatch, error: subjectiveError } =
      extractSportActivitySubjectivePatch(body, clubScales)

    if (subjectiveError) {
      return response.badRequest({ error: subjectiveError })
    }

    let activity = await this.activityService.updateActivity(athlete!.athleteid, id, payload)

    if (Object.keys(subjectivePatch).length > 0) {
      await this.subjectiveScaleValuesService.applyActivity(activity, clubScales, subjectivePatch)
      activity = await this.activityService.getActivity(athlete!.athleteid, id)
    }

    return response.json(activity.serialize())
  }

  public async deleteActivity({ response, athlete, request }: HttpContext) {
    const { id } = await deleteActivityParamsSchema.validate(request.params())
    await this.activityService.deleteActivity(athlete!.athleteid, id)
    return response.json({ message: 'Activity deleted successfully' })
  }

  public async getFitData({ response, request }: HttpContext) {
    const { id } = await getActivityParamsSchema.validate(request.params())
    const fitData = await this.sportActivityService.getFitDataFromSeries(id)

    return response.json(fitData)
  }
}
