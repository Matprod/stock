export const META_ENERGY_KJ = 'meta_energy_kj'
export const KJ_TO_KCAL_FACTOR = 4.184

export function postProcessMetric<
  T extends { name: string; value: number | string; unit?: string | null },
>(metric: T): T {
  let name = metric.name
  let currentValue: number | string = metric.value
  let currentUnit: string | null | undefined = metric.unit

  const numericValue = Number(currentValue)

  if (name === META_ENERGY_KJ && !Number.isNaN(numericValue)) {
    name = 'meta_energy_kcal'
    currentValue = Number((numericValue / KJ_TO_KCAL_FACTOR).toFixed(2))
    currentUnit = 'kcal'
  }

  return {
    ...metric,
    name,
    value: currentValue,
    unit: currentUnit ?? null,
  }
}
