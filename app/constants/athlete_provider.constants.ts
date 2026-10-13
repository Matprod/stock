export const ATHLETE_DATA_PROVIDER_TYPES = {
  CATAPULT: 'catapult',
  MY_COACH: 'my_coach',
  FIRSTBEAT: 'firstbeat',
  VALD: 'vald',
} as const

export type AthleteDataProviderType =
  (typeof ATHLETE_DATA_PROVIDER_TYPES)[keyof typeof ATHLETE_DATA_PROVIDER_TYPES]

export const ATHLETE_PROVIDER_TYPES = {
  API_BASKETBALL: 'api_basketball',
  TRAIN_MY_ATHLETE: 'train_my_athlete',
  CATAPULT: 'catapult',
  VALD: 'vald',
  FIRSTBEAT: 'firstbeat',
  MY_COACH: 'my_coach',
  GARMIN: 'garmin',
  WAHOO: 'wahoo',
  WHOOP: 'whoop',
  STATSPORTS: 'statsports',
  SAP: 'sap',
  SKILLCORNER: 'skillcorner',
  DFL: 'dfl',
} as const

export type AthleteProviderType =
  (typeof ATHLETE_PROVIDER_TYPES)[keyof typeof ATHLETE_PROVIDER_TYPES]

export const ATHLETE_PROVIDER_SOURCE = {
  MANUAL: 'manual',
  TMA: 'tma',
  SAP: 'sap',
} as const

export type AthleteProviderSource =
  (typeof ATHLETE_PROVIDER_SOURCE)[keyof typeof ATHLETE_PROVIDER_SOURCE]
