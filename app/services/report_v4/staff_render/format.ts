const FR_MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const

const THIN_SPACE = '\u202f'

export const formatStaffNumber = (
  value: number,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string => {
  if (!Number.isFinite(value)) return ''
  const maximumFractionDigits = options?.maximumFractionDigits ?? (Number.isInteger(value) ? 0 : 1)
  const minimumFractionDigits = options?.minimumFractionDigits ?? 0
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits,
    minimumFractionDigits,
    useGrouping: true,
  })
    .format(value)
    .replace(/\u00a0/g, THIN_SPACE)
}

export const formatStaffInteger = (value: number): string =>
  formatStaffNumber(Math.round(value), { maximumFractionDigits: 0, minimumFractionDigits: 0 })

export const formatStaffMonthName = (monthIndex0: number): string => {
  const month = FR_MONTHS[monthIndex0]
  if (!month) {
    throw new Error(`invalid month index ${monthIndex0}`)
  }
  return month
}

export const formatStaffMonthYear = (isoMonth: string): string => {
  const match = /^(\d{4})-(\d{2})$/.exec(isoMonth.trim())
  if (!match) {
    throw new Error(`expected YYYY-MM, got ${isoMonth}`)
  }
  const year = match[1]!
  const monthIndex = Number(match[2]) - 1
  return `${formatStaffMonthName(monthIndex)} ${year}`
}

export const formatStaffDayMonth = (isoDate: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!match) {
    throw new Error(`expected YYYY-MM-DD, got ${isoDate}`)
  }
  const day = Number(match[3])
  const monthIndex = Number(match[2]) - 1
  return `${day} ${formatStaffMonthName(monthIndex)}`
}

export const formatStaffDateRange = (startIso: string, endIso: string): string => {
  const start = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startIso.trim())
  const end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endIso.trim())
  if (!start || !end) {
    throw new Error(`expected YYYY-MM-DD range, got ${startIso} → ${endIso}`)
  }
  const startDay = Number(start[3])
  const endDay = Number(end[3])
  const startMonth = Number(start[2]) - 1
  const endMonth = Number(end[2]) - 1
  const year = end[1]!
  if (start[1] === end[1] && startMonth === endMonth) {
    return `${startDay}–${endDay} ${formatStaffMonthName(endMonth)} ${year}`
  }
  return `${formatStaffDayMonth(startIso)} – ${formatStaffDayMonth(endIso)} ${year}`
}
