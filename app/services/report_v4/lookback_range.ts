export type IsoDateRange = { from: string; to: string }

export type LookbackOptions = {
  ewmaWindowDays?: number
  lookbackDays?: number
}

export const EWMA_CHRONIC_MIN_LOOKBACK_DAYS = 28

const isoFromUtc = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const todayUtcIso = (): string => isoFromUtc(new Date())

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
