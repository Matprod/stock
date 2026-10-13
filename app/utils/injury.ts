import HealthPain from '#models_pg/health_pain'
import Injury from '#models_pg/injury'
import SportActivityPain from '#models_pg/sport_activity_pain'
import { DateTime } from 'luxon'

export const getPlayerCurrentInjury = (injuries: Injury[], date: DateTime): Injury | undefined => {
  const currentDate = date.toFormat('yyyy-MM-dd')
  return injuries.find((injury) => {
    if (!injury.dateOfInjury) return false
    const injuryDate = injury.dateOfInjury.toFormat('yyyy-MM-dd')
    const recoveryDate = injury.recoveryDate ? injury.recoveryDate.toFormat('yyyy-MM-dd') : null

    return injuryDate <= currentDate && (recoveryDate === null || recoveryDate > currentDate)
  })
}

export const shouldExcludeDateFromPrediction = (injuries: Injury[], date: DateTime): boolean => {
  const currentInjury = getPlayerCurrentInjury(injuries, date)
  if (!currentInjury || !currentInjury.dateOfInjury) {
    return false
  }

  const currentDate = date.toFormat('yyyy-MM-dd')
  const injuryDate = currentInjury.dateOfInjury.toFormat('yyyy-MM-dd')
  const recoveryDate = currentInjury.recoveryDate
    ? currentInjury.recoveryDate.toFormat('yyyy-MM-dd')
    : null

  if (currentDate === injuryDate) {
    return true
  }

  if (recoveryDate && currentDate === recoveryDate) {
    return false
  }

  if (!recoveryDate) {
    return true
  }

  return currentDate > injuryDate && currentDate < recoveryDate
}

export const shouldExcludeDateFromEWMA = (
  injuries: Injury[],
  date: DateTime,
  options?: {
    excludeInjuryDatePlusOne?: boolean
  }
): boolean => {
  const currentInjury = getPlayerCurrentInjury(injuries, date)
  if (!currentInjury || !currentInjury.dateOfInjury) {
    return false
  }

  const currentDate = date.toFormat('yyyy-MM-dd')
  const injuryDate = currentInjury.dateOfInjury.toFormat('yyyy-MM-dd')
  const injuryDatePlusOne = currentInjury.dateOfInjury.plus({ days: 1 }).toFormat('yyyy-MM-dd')
  const recoveryDate = currentInjury.recoveryDate
    ? currentInjury.recoveryDate.toFormat('yyyy-MM-dd')
    : null

  if (currentDate === injuryDate) {
    return false
  }

  if (!options?.excludeInjuryDatePlusOne && currentDate === injuryDatePlusOne) {
    return false
  }

  if (recoveryDate && currentDate === recoveryDate) {
    return false
  }

  if (!recoveryDate) {
    return true
  }

  return currentDate > injuryDate && currentDate < recoveryDate
}

export const getDefaultPains = ({
  injuries,
  date,
  healthPains,
  activityPains,
}: {
  injuries: Injury[]
  date: DateTime
  healthPains: HealthPain[]
  activityPains: SportActivityPain[]
}) => {
  const currentInjury = getPlayerCurrentInjury(injuries, date)
  const latestSameLocationHealthPain = healthPains.find((pain) => {
    if (!currentInjury || !currentInjury.dateOfInjury || !pain.health.day.dateOfDay) return false
    return (
      pain.health.day.dateOfDay >= currentInjury.dateOfInjury &&
      pain.health.day.dateOfDay <= date &&
      pain.location.name === currentInjury.injuryType.section?.name
    )
  })

  const latestSameLocationActivityPain = activityPains.find((pain) => {
    if (
      !currentInjury ||
      !currentInjury.dateOfInjury ||
      !pain.sportActivity.day.dateOfDay ||
      !date
    )
      return false
    return (
      pain.sportActivity.day.dateOfDay >= currentInjury.dateOfInjury &&
      pain.sportActivity.day.dateOfDay <= date &&
      pain.location.name === currentInjury.injuryType.section?.name
    )
  })

  if (latestSameLocationActivityPain && latestSameLocationHealthPain) {
    const moreRecentPain =
      latestSameLocationActivityPain.updatedAt > latestSameLocationHealthPain.updatedAt
        ? latestSameLocationActivityPain.rating
        : latestSameLocationHealthPain.rating
    return moreRecentPain
  } else if (latestSameLocationActivityPain) {
    return latestSameLocationActivityPain.rating
  } else if (latestSameLocationHealthPain) {
    return latestSameLocationHealthPain.rating
  }

  return currentInjury ? 5 : 0
}
