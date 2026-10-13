export const EXTERNAL_API_PREFIX = '/external/v1'
export const EXTERNAL_API_KEY_PREFIX = 'mna_live_'
export const EXTERNAL_API_KEY_PREFIX_VISIBLE_CHARS = 8

export const EXTERNAL_API_RATE_LIMIT = {
  requests: 100,
  duration: '1 minute',
} as const

export const EXTERNAL_API_LAST_USED_TOUCH_SECONDS = 60

export const EXTERNAL_API_SCORE_MAX_RANGE_DAYS = 90
