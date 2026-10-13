export const DISPLAY_VARIABLE_UNIT = {
  KG: 'kg',
  MIN_PER_KM: 'min/km',
  KCAL: 'kcal',
  BPM: 'bpm',
  M: 'm',
  M_PER_S: 'm/s',
  KM: 'km',
  KM_PER_H: 'km/h',
  WATTS: 'Watts',
  M_PER_S2: 'm/s2',
  MIN_PER_100M: 'min/100m',
  MINUTES: 'minutes',
} as const

export type DisplayVariableUnit = (typeof DISPLAY_VARIABLE_UNIT)[keyof typeof DISPLAY_VARIABLE_UNIT]
