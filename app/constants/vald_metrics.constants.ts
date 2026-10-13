export const VALD_TRIAL_METRIC_UNITS = {
  trial_jump_height: 'cm',
  trial_rsi_modified: '',
  trial_peak_takeoff_power: 'W',
  trial_concentric_rfd: 'N/s',
  trial_peak_landing_force: 'N',
  trial_time_to_stabilisation: 's',
  trial_rsi: '',
  trial_eccentric_braking_rfd: 'N/s',
} as const

export type ValdTrialMetricKey = keyof typeof VALD_TRIAL_METRIC_UNITS

export const VALD_TRIAL_METRIC_KEYS = Object.keys(VALD_TRIAL_METRIC_UNITS) as ValdTrialMetricKey[]

export const VALD_DEFAULT_METRIC_BY_TEST_TYPE: Record<string, ValdTrialMetricKey> = {
  CMJ: 'trial_jump_height',
  ABCMJ: 'trial_jump_height',
  CMRJ: 'trial_jump_height',
  SQT: 'trial_peak_landing_force',
}

export const isValdTrialMetricKey = (value: string): value is ValdTrialMetricKey =>
  value in VALD_TRIAL_METRIC_UNITS

export const defaultValdMetricForTestType = (testType: string): ValdTrialMetricKey =>
  VALD_DEFAULT_METRIC_BY_TEST_TYPE[testType] ?? 'trial_jump_height'

export const orderedValdMetricsForTestType = (testType: string): ValdTrialMetricKey[] => {
  const defaultKey = defaultValdMetricForTestType(testType)
  return [defaultKey, ...VALD_TRIAL_METRIC_KEYS.filter((key) => key !== defaultKey)]
}

export const valdMetricUnit = (key: ValdTrialMetricKey): string | null => {
  const unit = VALD_TRIAL_METRIC_UNITS[key]
  return unit.trim() ? unit : null
}

export const parseValdVariableField = (
  field: string
): { testType: string; metricKey: ValdTrialMetricKey } | null => {
  const separator = field.indexOf('.')
  if (separator <= 0) return null
  const testType = field.slice(0, separator)
  const metricKey = field.slice(separator + 1)
  if (!testType || !isValdTrialMetricKey(metricKey)) return null
  return { testType, metricKey }
}

export const buildValdVariableField = (testType: string, metricKey: ValdTrialMetricKey): string =>
  `${testType}.${metricKey}`
