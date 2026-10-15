import type { AppLanguage } from '#utils/localize'

export const formatReportNumber = (
  value: number,
  language: AppLanguage,
  options?: Intl.NumberFormatOptions
): string =>
  new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US', options).format(value)

export const formatReportDate = (
  isoDate: string,
  language: AppLanguage,
  options?: Intl.DateTimeFormatOptions
): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim())
  if (!match) return isoDate
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    ...options,
  }).format(date)
}
