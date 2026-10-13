import Event from '#models_pg/event'
import type SportActivity from '#models_pg/sport_activity'
import type {
  MobileCalendarEventDetail,
  MobileCalendarEventSummary,
  MobileCalendarSportActivityDetail,
} from '#contracts/mobile/calendar'
import AthleteService from '#services/athlete_service'
import { EventService, type EventTypesByCategory } from '#services/event_service'
import { fetchActivitySeriesDecodedByActivityIds } from '#utils/series'
import { DateTime } from 'luxon'

export default class MobileCalendarService {
  private athleteService: AthleteService
  private eventService: EventService

  constructor() {
    this.athleteService = new AthleteService()
    this.eventService = new EventService()
  }

  public async getEvents(
    athleteId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MobileCalendarEventSummary[]> {
    const athlete = await this.athleteService.getAthleteById(athleteId)
    if (!athlete?.clubId) {
      throw new Error('Athlete not found')
    }

    const start = DateTime.fromJSDate(startDate).startOf('day')
    const end = DateTime.fromJSDate(endDate).endOf('day')

    const [events, eventTypesByCategory] = await Promise.all([
      this.eventService.getEventsByAthleteAndDateRange(athleteId, athlete.clubId, start, end),
      this.eventService.getEventTypesByCategory(athlete.appLanguageOrDefault, athlete.clubId),
    ])

    return events.map((event) => this.formatEventSummary(event, eventTypesByCategory))
  }

  public async getEvent(
    athleteId: string,
    eventId: string
  ): Promise<MobileCalendarEventDetail | null> {
    const athlete = await this.athleteService.getAthleteById(athleteId)
    if (!athlete?.clubId) {
      throw new Error('Athlete not found')
    }

    const event = await this.eventService.getEventForAthlete(eventId, athleteId)
    if (!event) {
      return null
    }

    const eventTypesByCategory = await this.eventService.getEventTypesByCategory(
      athlete.appLanguageOrDefault,
      athlete.clubId
    )

    return this.formatEventDetail(event, eventTypesByCategory)
  }

  private async enrichSportActivityDetail(
    activity: SportActivity | undefined
  ): Promise<MobileCalendarSportActivityDetail | null> {
    if (!activity) return null

    const seriesByActivityId = await fetchActivitySeriesDecodedByActivityIds([activity.id])

    return {
      ...activity.serialize(),
      series: seriesByActivityId.get(activity.id) ?? [],
    } as MobileCalendarSportActivityDetail
  }

  private formatEventSummary(
    event: Event,
    eventTypesByCategory: EventTypesByCategory
  ): MobileCalendarEventSummary {
    const json = event.toJSON() as MobileCalendarEventSummary & {
      sportActivities?: SportActivity[]
    }
    const eventType = json.eventType
      ? {
          ...json.eventType,
          name:
            Object.values(eventTypesByCategory)
              .flat()
              .find((type) => type.id === json.eventType!.id)?.name ?? json.eventType.name,
        }
      : null

    const activity = event.sportActivities[0]
    const sportActivity = activity
      ? {
          id: activity.id,
          rpe: activity.rpe,
          muscularDifficulty: activity.muscularDifficulty,
          cardioRespiratory: activity.cardioRespiratory,
          pleasureLevel: activity.pleasureLevel,
          fatigueLevel: activity.fatigueLevel,
          fitnessLevel: activity.fitnessLevel,
          activeCalories: activity.activeCalories,
          sessionComment: activity.sessionComment,
        }
      : null

    return {
      id: json.id,
      title: json.title,
      startTime: json.startTime,
      endTime: json.endTime,
      location: json.location,
      eventType,
      sportActivity,
    }
  }

  private async formatEventDetail(
    event: Event,
    eventTypesByCategory: EventTypesByCategory
  ): Promise<MobileCalendarEventDetail> {
    const {
      sportActivities: _sportActivities,
      athletes: _athletes,
      ...json
    } = event.toJSON() as {
      sportActivities?: SportActivity[]
      athletes?: unknown[]
      eventType?: MobileCalendarEventSummary['eventType']
      [key: string]: unknown
    }

    const eventType = json.eventType
      ? {
          ...json.eventType,
          name:
            Object.values(eventTypesByCategory)
              .flat()
              .find((type) => type.id === json.eventType!.id)?.name ?? json.eventType.name,
        }
      : null

    return {
      ...json,
      eventType,
      sportActivity: await this.enrichSportActivityDetail(event.sportActivities[0]),
    } as MobileCalendarEventDetail
  }
}
