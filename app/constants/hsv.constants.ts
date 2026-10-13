export const HSV_API_URL = 'https://sqixwpwxxawsmokdxvmy.supabase.co/rest/v1/rpc'
export const HSV_DATA_SOURCE = 'hsv' as const
export const HSV_WELLNESS_ENDPOINT = 'get_wellness_data'
export const HSV_WELLNESS_START = '2026-07-14'
export const HSV_WINDOW_DAYS = 7
export const HSV_SYNC_LOOKBACK_DAYS = 7
export const HSV_PAGE_CAP = 1000
export const HSV_LIKERT_FACTOR = 10
export const HSV_IMPORT_CHUNK = 200

export const HSV_SKIP_NAMES = ['hamburg nutrition test athlete'] as const

export const HSV_ATHLETE_ALIASES: Record<string, string> = {
  'david moller wolfe': 'daniel moller wolfe',
  'martin gabriel belaid adeline': 'martin adeline',
  'shafiq bello nandja': 'shafiq nandja',
}

export const HSV_HEALTH_METRIC_TRAINING_RPE = 'training_rpe'
export const HSV_HEALTH_METRIC_INJURY_STATUS = 'injury_status'
