import { DateTime } from 'luxon'
import type { AppLanguage } from '#utils/localize'

export type IsoDateRange = { from: string; to: string }

type LookbackOptions = {
  ewmaWindowDays?: number
  lookbackDays?: number
}

export const EWMA_CHRONIC_MIN_LOOKBACK_DAYS = 28

export const DEFAULT_REPORT_TIMEZONE = 'Europe/Paris'

const isoFromUtc = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const todayUtcIso = (): string => isoFromUtc(new Date())

export const todayInTimeZone = (timeZone = DEFAULT_REPORT_TIMEZONE): string => {
  const iso = DateTime.now().setZone(timeZone).toISODate()
  return iso ?? todayUtcIso()
}

export const resolveClubReportTimeZone = (_club?: { language?: AppLanguage } | null): string =>
  DEFAULT_REPORT_TIMEZONE

export const previousCompleteCalendarWeek = (todayIso: string): IsoDateRange => {
  const [y, m, d] = todayIso.split('-').map(Number)
  const today = new Date(Date.UTC(y!, m! - 1, d!))
  const dow = today.getUTCDay()
  const daysSinceMonday = (dow + 6) % 7
  const thisMonday = new Date(today)
  thisMonday.setUTCDate(today.getUTCDate() - daysSinceMonday)
  const lastSunday = new Date(thisMonday)
  lastSunday.setUTCDate(thisMonday.getUTCDate() - 1)
  const lastMonday = new Date(lastSunday)
  lastMonday.setUTCDate(lastSunday.getUTCDate() - 6)
  return { from: isoFromUtc(lastMonday), to: isoFromUtc(lastSunday) }
}

export const currentWeekToDate = (todayIso: string): IsoDateRange => {
  const [y, m, d] = todayIso.split('-').map(Number)
  const today = new Date(Date.UTC(y!, m! - 1, d!))
  const dow = today.getUTCDay()
  const daysSinceMonday = (dow + 6) % 7
  const thisMonday = new Date(today)
  thisMonday.setUTCDate(today.getUTCDate() - daysSinceMonday)
  return { from: isoFromUtc(thisMonday), to: todayIso }
}

export const formatReportDateLabel = (
  isoDate: string,
  language: AppLanguage = 'en',
  timeZone = 'UTC'
): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return isoDate
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  })
}

export const dateToIsoDay = (value: Date | string): string => {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]!
  }
  return isoFromUtc(value instanceof Date ? value : new Date(value))
}

export const shiftIsoDate = (iso: string, days: number): string => {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return isoFromUtc(date)
}

const resolveLookbackDays = (options?: LookbackOptions): number => {
  const ewma = options?.ewmaWindowDays ?? EWMA_CHRONIC_MIN_LOOKBACK_DAYS
  const requested = options?.lookbackDays ?? 0
  return Math.max(EWMA_CHRONIC_MIN_LOOKBACK_DAYS, ewma, requested)
}

export const buildFetchRange = (
  display: IsoDateRange,
  options?: number | LookbackOptions
): IsoDateRange => {
  const lookbackDays =
    typeof options === 'number'
      ? Math.max(EWMA_CHRONIC_MIN_LOOKBACK_DAYS, options)
      : resolveLookbackDays(options)
  return {
    from: shiftIsoDate(display.from, -lookbackDays),
    to: display.to,
  }
}
