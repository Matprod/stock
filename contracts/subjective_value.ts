export type SubjectiveValues = Record<string, number | null>

export type SubjectiveValuesPatch = Record<string, number | null | undefined>

export type HealthSubjectivePayload = {
  ratings?: SubjectiveValuesPatch
  metrics?: SubjectiveValuesPatch
}

type CalendarHealthRowInput = {
  id: string
  day: {
    id: string
    athleteId: string
    dateOfDay: { toISODate?: () => string | null } | string | Date
  }
}

export const buildCalendarHealthRow = (
  health: CalendarHealthRowInput,
  ratings: SubjectiveValues,
  metrics: SubjectiveValues
) => {
  const dateOfDay = health.day.dateOfDay
  const dateStr =
    typeof dateOfDay === 'object' && dateOfDay !== null && 'toISODate' in dateOfDay
      ? (dateOfDay.toISODate?.() ?? String(dateOfDay).slice(0, 10))
      : String(dateOfDay).slice(0, 10)

  return {
    id: health.id,
    ratings,
    metrics,
    athleteId: health.day.athleteId,
    day: {
      id: health.day.id,
      athleteId: health.day.athleteId,
      dateOfDay: dateStr,
    },
  }
}
