const DURATION_HH_MM_REGEX = /^(\d{1,2}):(\d{2})$/
const DURATION_HH_MM_SS_REGEX = /^(\d{1,2}):(\d{2}):(\d{2})$/

export function parseDurationToMicroseconds(value: string | null | undefined): number {
  if (!value?.trim()) return 0
  const trimmed = String(value).trim()

  const matchHms = trimmed.match(DURATION_HH_MM_SS_REGEX)
  if (matchHms) {
    const [, h, m, s] = matchHms
    const hours = parseInt(h!, 10)
    const minutes = parseInt(m!, 10)
    const seconds = parseInt(s!, 10)
    return (hours * 3600 + minutes * 60 + seconds) * 1_000_000
  }

  const matchHm = trimmed.match(DURATION_HH_MM_REGEX)
  if (matchHm) {
    const [, h, m] = matchHm
    const hours = parseInt(h!, 10)
    const minutes = parseInt(m!, 10)
    return (hours * 3600 + minutes * 60) * 1_000_000
  }

  return 0
}

export function parseMinutesToSeconds(minutesPlayed: string | null): number | null {
  if (!minutesPlayed) return null
  const [m, s] = minutesPlayed.split(':').map(Number)
  return Number.isNaN(m) || Number.isNaN(s) ? null : m * 60 + s
}

export function parseTimeToSeconds(timeString: string | null): number | null {
  if (!timeString) return null
  const parts = timeString.split(':').map(Number)

  switch (parts.length) {
    case 1:
      return parts[0] * 60
    case 2:
      return parts[0] * 3600 + parts[1] * 60
    case 3:
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    default:
      return null
  }
}

export function secondsToMicroseconds(seconds: number | null): number | null {
  return seconds !== null ? Math.round(seconds * 1_000_000) : null
}

export function parseSecondsToDuration(durationInSeconds?: number | null): string {
  return parseMicrosecondsToDuration(secondsToMicroseconds(durationInSeconds ?? null))
}

export function parseMicrosecondsToDuration(durationInMicroseconds?: number | null): string {
  if (durationInMicroseconds !== 0 && !durationInMicroseconds) return 'N/A'
  const totalSeconds = durationInMicroseconds / 1_000_000
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

export const avg = (values: number[]): number | null => {
  if (!values.length) return null
  const sum = values.reduce((acc, v) => acc + v, 0)
  return sum / values.length
}

export const formatHoursToHhMm = (hours: number | null): string | null => {
  if (hours === null) return null
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const mm = String(m).padStart(2, '0')
  return `${h}h${mm}`
}

export const formatTotalHoursToHhMm = (hours: number | null): string | null => {
  if (hours === null) return null
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const mm = String(m).padStart(2, '0')
  return `${h}h${mm}`
}

export const avgMinutesToTime = (minutesArr: number[]): string | null => {
  const averageMinutes = avg(minutesArr)
  if (averageMinutes === null) return null
  const totalMinutes = Math.round(averageMinutes)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${hh}:${mm}`
}

export const formatMinutesToHuman = (totalMinutes: number): string | null => {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return null
  const roundedMinutes = Math.round(totalMinutes)
  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60
  return `${hours}h ${minutes}min`
}
