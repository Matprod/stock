import type { AppLanguage } from '#utils/localize'
import { DateTime } from 'luxon'
import Athlete from '#models_pg/athlete'
import Day from '#models_pg/day'
import SportActivity from '#models_pg/sport_activity'

export interface GetAthleteWithDetailsPayload {
  athleteId: string
  days?: number
  startDate?: string
}

export interface GetAthletePayload {
  athleteId: string
  language: AppLanguage
  allTime?: boolean
  seasonStartDate?: DateTime | null
  seasonEndDate?: DateTime | null
}

export interface GetAthleteListByClubPayload {
  clubId: string
  isDemoUser: boolean
  language: AppLanguage
  seasonStartDate?: DateTime | null
  seasonEndDate?: DateTime | null
}

export interface GetAthletesByClubPayload {
  clubId: string
  isDemoUser?: boolean
  seasonStartDate?: DateTime | null
  seasonEndDate?: DateTime | null
}

export interface ActivityZones {
  zone1: number
  zone2: number
  zone3: number
  zone4: number
  zone5: number
}

type SportActivityWithZones = SportActivity & {
  zones?: ActivityZones
}

type DayWithActivitiesWithZones = Omit<Day, 'sportActivities'> & {
  sportActivities?: SportActivityWithZones[]
}

export type AthleteWithZones = Omit<Athlete, 'days'> & {
  days?: DayWithActivitiesWithZones[]
}
