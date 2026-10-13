import type { ReportFormulaId } from '#constants/report_builder.constants'

export type LoadFormulaSpec = {
  id: ReportFormulaId
  outputColumn: string
  params?: { n?: number }
}

const fold = (value: string): string => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

const ewmaPair = (): LoadFormulaSpec[] => [
  { id: 'ewma', outputColumn: 'ewma_7', params: { n: 7 } },
  { id: 'ewma', outputColumn: 'ewma_28', params: { n: 28 } },
]

export const resolveLoadFormulaSpecs = (
  coachPrompt: string,
  loadFlag?: string
): LoadFormulaSpec[] => {
  if (loadFlag === 'coupled_7_28') {
    return [...ewmaPair(), { id: 'acwr_ma', outputColumn: 'acwr_ma' }]
  }
  if (loadFlag === 'acwr_ewma') {
    return [...ewmaPair(), { id: 'acwr_ewma', outputColumn: 'acwr_ewma' }]
  }
  if (loadFlag === 'volume_only') {
    return [{ id: 'cumulative', outputColumn: 'cumulative_7', params: { n: 7 } }]
  }

  const text = fold(coachPrompt)
  const wantsCoupled = /coupled\s*7\s*[:/]\s*28/.test(text)
  const wantsAcwr = /\bacwr\b|acute\s*[:=-]?\s*chronic/.test(text) || wantsCoupled
  const wantsEwma = /\bewma\b/.test(text) || wantsAcwr
  const wantsMonotony = /\bmonoton/.test(text)
  const wantsStrain = /\bstrain\b/.test(text)
  const wantsCumulative = /\bcumul|\bcumulative\b/.test(text)
  const specs: LoadFormulaSpec[] = []
  if (wantsEwma) specs.push(...ewmaPair())
  if (wantsCoupled) specs.push({ id: 'acwr_ma', outputColumn: 'acwr_ma' })
  else if (wantsAcwr) specs.push({ id: 'acwr_ewma', outputColumn: 'acwr_ewma' })
  if (wantsMonotony) specs.push({ id: 'monotony', outputColumn: 'monotony' })
  if (wantsStrain) specs.push({ id: 'strain', outputColumn: 'strain' })
  if (wantsCumulative) {
    specs.push({ id: 'cumulative', outputColumn: 'cumulative_7', params: { n: 7 } })
  }
  return specs
}

export const pickLoadValueColumn = (columns: string[]): string => {
  if (columns.includes('srpe_daily')) return 'srpe_daily'
  const preferred = columns.find((col) =>
    /^(srpe_daily|srpe|session_rpe|internal_load|player_load|dsl)$/i.test(col)
  )
  if (preferred) return preferred
  return (
    columns.find((col) => /srpe|player_?load|\bdsl\b|internal.?load/i.test(col)) ?? 'srpe_daily'
  )
}

export const countPositiveLoad = (
  rows: Array<Record<string, unknown>>,
  valueColumn: string,
  toNumber: (value: unknown) => number | null
): number =>
  rows.reduce((n, row) => {
    const v = toNumber(row[valueColumn])
    return v != null && v > 0 ? n + 1 : n
  }, 0)
