import type BasketballGame from '#models_pg/basketball_game'
import Event from '#models_pg/event'
import EventType from '#models_pg/event_type'
import SportActivity from '#models_pg/sport_activity'
import type { SerieEntry } from '#utils/series'

export type MobileSportActivitySummary = Pick<
  SportActivity,
  | 'id'
  | 'rpe'
  | 'muscularDifficulty'
  | 'cardioRespiratory'
  | 'pleasureLevel'
  | 'fatigueLevel'
  | 'fitnessLevel'
  | 'activeCalories'
  | 'sessionComment'
>

export type MobileCalendarSportActivityDetail = MobileSportActivitySummary &
  Pick<
    SportActivity,
    | 'dataSource'
    | 'distance'
    | 'speed'
    | 'durationSeconds'
    | 'elevation'
    | 'power'
    | 'activeCalories'
    | 'averagedBpm'
    | 'cadence'
    | 'elevationDescent'
    | 'fcMax'
    | 'createdAt'
    | 'updatedAt'
    | 'timeOfActivity'
    | 'trainingLoad'
    | 'gameActivity'
    | 'activityName'
    | 'activityTypeId'
  > & {
    series: SerieEntry[]
  }

export type MobileCalendarEventTypeSummary = Pick<
  EventType,
  'id' | 'name' | 'color' | 'icon' | 'eventCategory' | 'activityId'
>

export type MobileCalendarEventSummary = Pick<
  Event,
  'id' | 'title' | 'startTime' | 'endTime' | 'location'
> & {
  eventType: MobileCalendarEventTypeSummary | null
  sportActivity: MobileSportActivitySummary | null
}

export type MobileCalendarEventDetail = Pick<
  Event,
  | 'id'
  | 'title'
  | 'startTime'
  | 'endTime'
  | 'location'
  | 'eventTypeId'
  | 'clubId'
  | 'createdAt'
  | 'updatedAt'
> & {
  eventType: MobileCalendarEventTypeSummary | null
  sportActivity: MobileCalendarSportActivityDetail | null
  basketballGames?: BasketballGame[]
}
