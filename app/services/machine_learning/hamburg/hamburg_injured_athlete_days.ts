import { HAMBURG_ML_DATE_FORMAT } from '#constants/hamburg_ml.constants'
import Injury from '#models_pg/injury'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export type AthleteDayRef = {
  athleteId: string
  dateOfDay: string
}

export const athleteDayKey = (athleteId: string, dateOfDay: string) => `${athleteId}|${dateOfDay}`

export const loadInjuredAthleteDayKeys = async (
  refs: AthleteDayRef[],
  trx?: TransactionClientContract
): Promise<Set<string>> => {
  const athleteIds = [...new Set(refs.map((ref) => ref.athleteId))]
  const dates = [...new Set(refs.map((ref) => ref.dateOfDay))].sort()
  if (athleteIds.length === 0 || dates.length === 0) {
    return new Set()
  }

  const from = dates[0]
  const to = dates[dates.length - 1]
  const requested = new Set(refs.map((ref) => athleteDayKey(ref.athleteId, ref.dateOfDay)))

  const injuries = await Injury.query({ client: trx })
    .whereIn('athleteId', athleteIds)
    .whereNotNull('dateOfInjury')
    .where('dateOfInjury', '<=', to)
    .where((query) => {
      query.whereNull('recoveryDate').orWhere('recoveryDate', '>=', from)
    })
    .select(['athleteId', 'dateOfInjury', 'recoveryDate'])

  const injured = new Set<string>()

  for (const injury of injuries) {
    if (!injury.dateOfInjury) continue
    const start = injury.dateOfInjury.toFormat(HAMBURG_ML_DATE_FORMAT)
    const end = injury.recoveryDate
      ? injury.recoveryDate.toFormat(HAMBURG_ML_DATE_FORMAT)
      : to

    for (const dateOfDay of dates) {
      if (dateOfDay < start || dateOfDay > end) continue
      const key = athleteDayKey(injury.athleteId, dateOfDay)
      if (requested.has(key)) {
        injured.add(key)
      }
    }
  }

  return injured
}
