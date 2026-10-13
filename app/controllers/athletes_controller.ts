import type { HttpContext } from '@adonisjs/core/http'
import Athlete from '#models_pg/athlete'
import Day from '#models_pg/day'
import File from '#models_pg/file'
//import { Insights } from '#contracts/insights'
import AthleteService from '#services/athlete_service'
import S3Service from '#services/s3_service'
import SeasonService from '#services/season_service'
import { schema, validator } from '@adonisjs/validator'
import { DateTime } from 'luxon'
import {
  athleteIdSchema,
  tdeeSchema,
  bmrSchema,
  getAthleteSchema,
  getInsightsSchema,
  //getInsightsSchema,
} from '#schemas/athlete'
import { getLanguageFromRequest } from '../utils/language.js'
import { FILE_TYPE } from '#constants/file.constants'
import { Insights } from '#contracts/insights'

export default class AthletesController {
  private athleteService: AthleteService
  private s3Service: S3Service
  private seasonService: SeasonService

  constructor() {
    this.athleteService = new AthleteService()
    this.s3Service = new S3Service()
    this.seasonService = new SeasonService()
  }

  // async mealFilled({ response, request, auth, params }: HttpContext) {
  //   const { id } = await athleteIdSchema.validate(params)

  //   const { date } = await validator.validate({
  //     schema: schema.create({
  //       date: schema.string(),
  //     }),
  //     data: request.qs(),
  //   })

  //   const clubId = auth.user!.clubId

  //   const athlete = await Athlete.query().where('id', id).where('clubId', clubId).first()

  //   if (!athlete) {
  //     return response.notFound({ message: 'Athlete not found' })
  //   }

  //   const result = await this.athleteService.mealFilled(athlete.id, date)

  //   return response.json(result)
  // }

  async teamList({ response, auth, request }: HttpContext) {
    const seasonInfo = await this.seasonService.getSeasonFromRequest(request, auth.user!.clubId)

    const result = await this.athleteService.getAthleteListByClub({
      clubId: auth.user!.clubId,
      // TODO refacto: constant 31 was a number
      isDemoUser: auth.user!.id === '31',
      language: getLanguageFromRequest(request),
      seasonStartDate: seasonInfo.seasonStartDate,
      seasonEndDate: seasonInfo.seasonEndDate,
    })
    return response.json(result)
  }

  async getOne({ params, response, auth, request }: HttpContext) {
    const { id } = await athleteIdSchema.validate(params)
    const { allTime } = await getAthleteSchema.validate(request.qs())
    const clubId = auth.user!.clubId
    const language = getLanguageFromRequest(request)
    const seasonInfo = await this.seasonService.getSeasonFromRequest(request, clubId)

    const athlete = await this.athleteService.getAthlete({
      athleteId: id,
      language,
      seasonStartDate: seasonInfo.seasonStartDate,
      seasonEndDate: seasonInfo.seasonEndDate,
      allTime,
    })

    if (!athlete || athlete.clubId !== clubId) {
      return response.notFound({ message: 'Athlete not found' })
    }

    if (seasonInfo.seasonId && seasonInfo.seasonStartDate && seasonInfo.seasonEndDate) {
      const { startDate: athleteStartDate, endDate: athleteEndDate } = athlete

      if (
        (athleteStartDate && athleteStartDate > seasonInfo.seasonEndDate) ||
        (athleteEndDate && athleteEndDate < seasonInfo.seasonStartDate)
      ) {
        return response.notFound({ message: 'Athlete not found in this season' })
      }
    }

    return response.json(athlete)
  }

  async show({ params, response, auth }: HttpContext) {
    const showSchema = schema.create({
      id: schema.string(),
    })

    const { id } = await validator.validate({
      schema: showSchema,
      data: params,
    })

    const clubId = auth.user!.clubId
    const athlete = await this.athleteService.getAthleteWithDetails({
      athleteId: id,
    })

    if (!athlete || athlete.clubId !== clubId) {
      return response.notFound({ message: 'Athlete not found' })
    }

    return response.json(athlete)
  }

  async list({ response, auth, request }: HttpContext) {
    const seasonInfo = await this.seasonService.getSeasonFromRequest(request, auth.user!.clubId)
    const athletes = await this.athleteService.getAthletesByClub({
      clubId: auth.user!.clubId,
      // TODO refacto: constant 31 was a number
      isDemoUser: auth.user!.id === '31',
      seasonStartDate: seasonInfo.seasonStartDate,
      seasonEndDate: seasonInfo.seasonEndDate,
    })
    return response.json(athletes)
  }

  async insights({ params, response, request, auth }: HttpContext) {
    const insightsSchema = schema.create({
      id: schema.string(),
    })

    const { id } = await validator.validate({
      schema: insightsSchema,
      data: params,
    })

    const { date, type, allTime } = await getInsightsSchema.validate(request.qs())

    const clubId = auth.user!.clubId
    const language = getLanguageFromRequest(request)
    const seasonInfo = await this.seasonService.getSeasonFromRequest(request, clubId)

    if (seasonInfo.seasonStartDate && seasonInfo.seasonEndDate && !allTime) {
      const requestDate = DateTime.fromFormat(date, 'yyyy-MM-dd')
      if (
        requestDate < seasonInfo.seasonStartDate.startOf('day') ||
        requestDate > seasonInfo.seasonEndDate.endOf('day')
      ) {
        return response.badRequest({
          message: 'Date is outside the selected season range',
        })
      }
    }

    const athlete = await Athlete.query().where('id', id).first()

    if (!athlete || athlete.clubId !== clubId) {
      return response.notFound({ message: 'Athlete not found' })
    }

    // TODO refacto: Delete ?
    const day = await this.athleteService.getDayWithAverage(athlete.id, date)

    if (!day) {
      return response.notFound({ message: 'Day not found' })
    }

    const insights = await this.athleteService.getInsights(athlete.id, date, type, language)

    const healthInsightsData = insights.filter((insight) => insight.type === 'health')
    const activityInsightsData = insights.filter((insight) => insight.type === 'activity')
    const sleepInsightsData = insights.filter((insight) => insight.type === 'sleep')
    const nutritionInsightsData = insights.filter((insight) => insight.type === 'nutrition')

    const res: Insights = {
      athleteId: athlete.id,
      performanceScore: day.performanceScore ?? null,
      injuryScore: day.injuryRiskScore ?? null,
      activityInsight: {
        insights: activityInsightsData,
        score: undefined,
      },
      sleepInsight: {
        insights: sleepInsightsData,
        score: undefined,
      },
      nutritionInsight: {
        insights: nutritionInsightsData,
        score: undefined,
      },
      healthInsight: {
        insights: healthInsightsData,
        score: undefined,
      },
    }

    return response.json(res)
  }

  async uploadProfilePicture({ params, response, auth, request }: HttpContext) {
    const { id } = await athleteIdSchema.validate(params)
    const clubId = auth.user!.clubId

    const athlete = await Athlete.query()
      .where('id', id)
      .where('clubId', clubId)
      .preload('profilePicture')
      .first()

    if (!athlete) {
      return response.notFound({ message: 'Athlete not found' })
    }

    const profilePicture = request.file('profilePicture')
    if (!profilePicture) {
      return response.badRequest({ message: 'No file uploaded' })
    }

    if (!profilePicture.isValid) {
      return response.badRequest({
        message: 'Invalid file',
        errors: profilePicture.errors,
      })
    }

    try {
      if (athlete.profilePicture) {
        await this.s3Service.deleteFile(athlete.profilePicture.key)
        await athlete.profilePicture.delete()
      }

      const { key } = await this.s3Service.uploadFile(profilePicture, 'profile-pictures')

      await File.create({
        type: FILE_TYPE.IMAGE,
        key: key,
        fileName: profilePicture.clientName || key,
        athleteId: athlete.id,
      })

      return response.status(200)
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      return response.internalServerError({
        message: 'Error uploading profile picture',
      })
    }
  }

  async getSeasons({ response, auth }: HttpContext) {
    const clubId = auth.user!.clubId
    const seasons = await this.athleteService.getSeasonsByClub(clubId)
    return response.json(seasons)
  }

  async getTDEE({ request, response }: HttpContext) {
    try {
      const queryParams = request.qs()
      const { athlete_id, date } = await tdeeSchema.validate(queryParams)
      const targetDate = date ?? DateTime.now().toFormat('yyyy-MM-dd')

      const athlete = await Athlete.query().where('id', athlete_id).firstOrFail()

      const day = await Day.query()
        .where('athleteId', athlete_id)
        .where('dateOfDay', targetDate)
        .preload('sportActivities', (sportActivitiesQuery) => {
          sportActivitiesQuery.preload('sport')
        })
        .first()

      const dayForCalculation = day || new Day()
      if (!day) {
        dayForCalculation.dateOfDay = DateTime.fromFormat(targetDate, 'yyyy-MM-dd')
        dayForCalculation.athleteId = athlete.id
      }
      const tdee = await this.athleteService.calculateTDEE(
        athlete,
        day?.sportActivities || [],
        dayForCalculation
      )
      return response.json({
        success: true,
        data: {
          tdee: tdee,
        },
      })
    } catch (error) {
      return response.internalServerError({ error: 'Internal server error' })
    }
  }

  async getBMR({ request, response }: HttpContext) {
    try {
      const { athlete_id } = await bmrSchema.validate(request.qs())

      const athlete = await Athlete.query().where('id', athlete_id).firstOrFail()

      return response.json({
        success: true,
        data: {
          bmr: athlete.BMR,
        },
      })
    } catch {
      return response.internalServerError({ error: 'Internal server error' })
    }
  }
}
