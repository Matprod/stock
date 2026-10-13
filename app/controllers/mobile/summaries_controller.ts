import type { HttpContext } from '@adonisjs/core/http'
import SummaryService from '#services/summary_service'
import {
  generateMobileActivitySummarySchema,
  generateMobileNutritionSummarySchema,
  generateMobileHealthSummarySchema,
  generateMobileSleepSummarySchema,
  getMobileActivitySummaryParamsSchema,
  getMobileNutritionSummaryParamsSchema,
  getMobileSleepSummaryParamsSchema,
  getMobileHealthSummaryParamsSchema,
} from '#schemas/mobile/summaries'

export default class MobileSummariesController {
  private summaryService: SummaryService

  constructor() {
    this.summaryService = new SummaryService()
  }

  public async generateActivitySummary({ request, response, athlete }: HttpContext) {
    console.log('athlete', athlete)
    try {
      console.log('request.body()', request.body())
      const { entity_id, date, is_delete } = await generateMobileActivitySummarySchema.validate(
        request.body()
      )

      const athleteId = athlete!.athleteid

      const summary = await this.summaryService.generateActivitySummary({
        entityId: entity_id,
        date,
        athleteId,
        is_delete,
      })

      return response.json(summary)
    } catch (error) {
      console.log('error', error)
      return response.internalServerError({
        message: error instanceof Error ? error.message : 'Error generating activity summary',
      })
    }
  }

  public async generateNutritionSummary({ request, response, athlete }: HttpContext) {
    try {
      const { date } = await generateMobileNutritionSummarySchema.validate(request.body())

      const athleteId = athlete!.athleteid

      const summary = await this.summaryService.generateNutritionSummary({
        date,
        athleteId,
      })

      return response.json(summary)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Complete at least')
      ) {
        return response.badRequest({ message: error.message })
      }

      return response.internalServerError({
        message: error instanceof Error ? error.message : 'Error generating nutrition summary',
      })
    }
  }

  public async getNutritionSummaryMeta({ params, response, athlete }: HttpContext) {
    try {
      const { date } = await getMobileNutritionSummaryParamsSchema.validate(params)
      const athleteId = athlete!.athleteid

      const meta = await this.summaryService.getNutritionSummaryMeta({
        date,
        athleteId,
      })

      return response.json(meta)
    } catch (error) {
      return response.internalServerError({
        message:
          error instanceof Error ? error.message : 'Error getting nutrition summary metadata',
      })
    }
  }

  public async generateSleepSummary({ request, response, athlete }: HttpContext) {
    try {
      const { date } = await generateMobileSleepSummarySchema.validate(request.body())

      const athleteId = athlete!.athleteid

      const summary = await this.summaryService.generateSleepSummary({
        date,
        athleteId,
      })

      return response.json(summary)
    } catch (error) {
      return response.internalServerError({
        message: error instanceof Error ? error.message : 'Error generating sleep summary',
      })
    }
  }

  public async generateHealthSummary({ request, response, athlete }: HttpContext) {
    try {
      const { date, is_delete } = await generateMobileHealthSummarySchema.validate(request.body())

      const athleteId = athlete!.athleteid

      const summary = await this.summaryService.generateHealthSummary({
        date,
        athleteId,
        is_delete,
      })

      return response.json(summary)
    } catch (error) {
      return response.internalServerError({
        message: error instanceof Error ? error.message : 'Error generating health summary',
      })
    }
  }

  public async getActivitySummary({ params, response, athlete }: HttpContext) {
    try {
      const { date, entity_id } = await getMobileActivitySummaryParamsSchema.validate(params)

      const athleteId = athlete!.athleteid

      const summary = await this.summaryService.getActivitySummary({
        date,
        athleteId,
        entityId: entity_id,
      })

      return response.json(summary)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Complete activity data')) {
        return response.badRequest({ message: error.message })
      }

      if (error instanceof Error && error.message === 'Activity not found') {
        return response.notFound({ message: 'Summary not found' })
      }

      return response.internalServerError({
        message: error instanceof Error ? error.message : 'Error getting activity summary',
      })
    }
  }

  public async getNutritionSummary({ params, response, athlete }: HttpContext) {
    try {
      const { date } = await getMobileNutritionSummaryParamsSchema.validate(params)

      const athleteId = athlete!.athleteid

      const summary = await this.summaryService.getNutritionSummary({
        date,
        athleteId,
      })

      return response.json(summary)
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('Complete at least') ||
          error.message.includes('Complete all meal types'))
      ) {
        return response.badRequest({ message: error.message })
      }

      if (error instanceof Error && error.message === 'Summary not found') {
        return response.notFound({ message: 'Summary not found' })
      }

      return response.internalServerError({
        message: error instanceof Error ? error.message : 'Error getting nutrition summary',
      })
    }
  }

  public async getSleepSummary({ params, response, athlete }: HttpContext) {
    try {
      const { date } = await getMobileSleepSummaryParamsSchema.validate(params)

      const athleteId = athlete!.athleteid

      const summary = await this.summaryService.getSleepSummary({
        date,
        athleteId,
      })

      return response.json(summary)
    } catch (error) {
      console.log('Error getting sleep summary', error)
      if (
        error instanceof Error &&
        (error.message.includes('Complete your sleep data') || error.message.includes('sleep data'))
      ) {
        return response.badRequest({ message: error.message })
      }

      return response.internalServerError({
        message: error instanceof Error ? error.message : 'Error getting sleep summary',
      })
    }
  }

  public async getHealthSummary({ params, response, athlete }: HttpContext) {
    try {
      const { date } = await getMobileHealthSummaryParamsSchema.validate(params)

      const athleteId = athlete!.athleteid

      const summary = await this.summaryService.getHealthSummary({
        date,
        athleteId,
      })

      return response.json(summary)
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('mandatory health fields') ||
          error.message.includes('Complete all mandatory health fields'))
      ) {
        return response.badRequest({ message: error.message })
      }

      return response.internalServerError({
        message: error instanceof Error ? error.message : 'Error getting health summary',
      })
    }
  }
}
