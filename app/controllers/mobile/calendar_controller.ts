import type { HttpContext } from '@adonisjs/core/http'
import Day from '#models_pg/day'
import { DateTime } from 'luxon'
import { calendarDateRangeQuerySchema, calendarEventParamsSchema } from '#schemas/mobile/calendar'
import AthleteService from '#services/athlete_service'
import { EventService } from '#services/event_service'
import MobileCalendarService from '#services/mobile/calendar_service'

export default class MobileCalendarController {
  private athleteService: AthleteService
  private calendarService: MobileCalendarService
  private eventService: EventService

  constructor() {
    this.athleteService = new AthleteService()
    this.calendarService = new MobileCalendarService()
    this.eventService = new EventService()
  }

  public async getEvents({ request, response, athlete }: HttpContext) {
    const { startDate, endDate } = await calendarDateRangeQuerySchema.validate(request.qs())

    try {
      const start = DateTime.fromJSDate(startDate).startOf('day')
      const end = DateTime.fromJSDate(endDate).startOf('day')

      if (end < start) {
        return response.badRequest({
          message: 'Invalid date range. `endDate` must be after `startDate`.',
        })
      }

      const events = await this.calendarService.getEvents(athlete!.athleteid, startDate, endDate)

      return response.json(events)
    } catch (error: any) {
      if (error?.message === 'Athlete not found') {
        return response.notFound({ message: error.message })
      }
      return response.badRequest({
        message: error?.message ?? 'An error occurred while fetching calendar events.',
      })
    }
  }

  public async getEvent({ request, response, athlete }: HttpContext) {
    const { id } = await calendarEventParamsSchema.validate(request.params())

    try {
      const event = await this.calendarService.getEvent(athlete!.athleteid, id)

      if (!event) {
        return response.notFound({ message: 'Event not found' })
      }

      return response.json(event)
    } catch (error: any) {
      if (error?.message === 'Athlete not found') {
        return response.notFound({ message: error.message })
      }
      return response.badRequest({
        message: error?.message ?? 'An error occurred while fetching the event.',
      })
    }
  }

  public async getEventTypes({ response, athlete }: HttpContext) {
    const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
    if (!athleteRecord?.clubId) {
      return response.notFound({ message: 'Athlete not found' })
    }

    const eventTypes = await this.eventService.getEventTypesByCategory(
      athleteRecord.appLanguageOrDefault,
      athleteRecord.clubId
    )

    return response.json(eventTypes)
  }

  public async calendarCheck({ request, response, athlete }: HttpContext) {
    const { startDate, endDate } = await calendarDateRangeQuerySchema.validate(request.qs())

    try {
      const start = DateTime.fromJSDate(startDate).startOf('day')
      const end = DateTime.fromJSDate(endDate).startOf('day')

      if (end < start) {
        return response.badRequest({
          message: 'Invalid date range. `endDate` must be after `startDate`.',
        })
      }

      const athleteId = athlete!.athleteid

      const days = await Day.query()
        .where('athleteId', athleteId)
        .whereBetween('dateOfDay', [start.toJSDate(), end.toJSDate()])
        .preload('sleeps')
        .preload('sportActivities')
        .preload('nutrition')
        .preload('health')

      const daysByDate: Record<string, Day> = {}

      for (const day of days) {
        const isoDate = day.dateOfDay?.toISODate()
        if (isoDate) {
          daysByDate[isoDate] = day
        }
      }

      const dateRange: DateTime[] = []
      for (let current = start; current <= end; current = current.plus({ days: 1 })) {
        dateRange.push(current)
      }

      const result = dateRange.map((date) => {
        const isoDate = date.toISODate()
        const day = isoDate ? daysByDate[isoDate] : undefined

        const hasSleepData = !!day && !!day.sleeps && day.sleeps.length > 0
        const hasSportActivity = !!day && !!day.sportActivities && day.sportActivities.length > 0
        const hasNutrition = !!day && !!day.nutrition && day.nutrition.length > 0
        const hasHealth = !!day && !!day.health

        let status = 0
        if (hasSleepData && hasNutrition && hasHealth) {
          status = 2
        } else if (hasSleepData || hasSportActivity || hasNutrition || hasHealth) {
          status = 1
        }

        return {
          date: isoDate,
          hasSleepData,
          hasSportActivity,
          hasNutrition,
          hasHealth,
          status,
        }
      })

      return response.json(result)
    } catch (error: any) {
      return response.badRequest({
        message: error?.message ?? 'An error occurred while checking calendar.',
      })
    }
  }
}
