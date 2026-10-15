import { pickAthleteColumn } from '#constants/premium_report_metrics'
import type { PremiumDataset } from '#contracts/premium_report'
import { toNumber } from '#services/premium_report/dataset_ops'
import { displayColumnLabel } from '#services/premium_report/column_labels'
import { isImputedCell } from '#services/report_v4/imputed_cells'
import { computeFactValue } from '#services/report_v4/report_facts'
import type { AppLanguage } from '#utils/localize'

export type SheetCommentFactOp = 'min' | 'max' | 'mean' | 'delta'

export type SheetCommentFact = {
  id: string
  athlete: string
  metric: string
  op: SheetCommentFactOp
  value: number
  datasetId: string
}

export type SheetRetainedMeasure = {
  datasetId: string
  metric: string
}

const fold = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()

const slugPart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)

const factId = (athlete: string, metric: string, op: SheetCommentFactOp): string =>
  `sheet.${slugPart(athlete)}.${slugPart(metric)}.${op}`

const athleteFilter = (athleteName: string, column: string) => ({
  column,
  op: 'eq' as const,
  value: athleteName,
})

const nearEquals = (left: number, right: number): boolean => {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false
  if (left === right) return true
  const scale = Math.max(1, Math.abs(left), Math.abs(right))
  return Math.abs(left - right) <= Math.max(0.051, scale * 1e-6)
}

const valueInFacts = (value: number, facts: SheetCommentFact[]): boolean =>
  facts.some((fact) => nearEquals(fact.value, value))

const parseLocalized = (raw: string): number | null => {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const RANGE_RE = /(\d+(?:[.,]\d+)?)\s*(?:[-–—]|to|au|à)\s*(\d+(?:[.,]\d+)?)/gi
const NUMBER_RE = /(?<![A-Za-z0-9_])(-?\d+(?:[.,]\d+)?)(?![A-Za-z0-9_])/g
const DATE_MASK_RE =
  /\b\d{4}-\d{2}-\d{2}\b|\b20\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g

const resolveMeasureDataset = (
  measure: SheetRetainedMeasure,
  datasets: PremiumDataset[]
): PremiumDataset | undefined => {
  const byId = datasets.find((dataset) => dataset.id === measure.datasetId)
  if (byId?.columns.includes(measure.metric)) return byId
  return datasets.find((dataset) => dataset.columns.includes(measure.metric))
}

export const buildSheetCommentFactsForAthlete = (args: {
  athlete: string
  measures: SheetRetainedMeasure[]
  datasets: Iterable<PremiumDataset>
}): SheetCommentFact[] => {
  const datasets = [...args.datasets]
  const out: SheetCommentFact[] = []
  for (const measure of args.measures) {
    const dataset = resolveMeasureDataset(measure, datasets)
    if (!dataset) continue
    const athleteCol = pickAthleteColumn(dataset.columns)
    if (!athleteCol) continue
    const filter = athleteFilter(args.athlete, athleteCol)
    const teamMean = computeFactValue({ dataset, op: 'mean', column: measure.metric })
    const ops: Array<{ op: SheetCommentFactOp; result: ReturnType<typeof computeFactValue> }> = [
      {
        op: 'min',
        result: computeFactValue({ dataset, op: 'min', column: measure.metric, filter }),
      },
      {
        op: 'max',
        result: computeFactValue({ dataset, op: 'max', column: measure.metric, filter }),
      },
      {
        op: 'mean',
        result: computeFactValue({ dataset, op: 'mean', column: measure.metric, filter }),
      },
    ]
    for (const row of ops) {
      if (!row.result.ok) continue
      out.push({
        id: factId(args.athlete, measure.metric, row.op),
        athlete: args.athlete,
        metric: measure.metric,
        op: row.op,
        value: row.result.value,
        datasetId: dataset.id,
      })
    }
    const mean = ops.find((row) => row.op === 'mean')?.result
    if (mean?.ok && teamMean.ok) {
      out.push({
        id: factId(args.athlete, measure.metric, 'delta'),
        athlete: args.athlete,
        metric: measure.metric,
        op: 'delta',
        value: mean.value - teamMean.value,
        datasetId: dataset.id,
      })
    }
  }
  return out
}

export const buildSheetCommentFactsByAthlete = (args: {
  athletes: string[]
  measures: SheetRetainedMeasure[]
  datasets: Iterable<PremiumDataset>
}): Record<string, SheetCommentFact[]> => {
  const out: Record<string, SheetCommentFact[]> = {}
  for (const athlete of args.athletes) {
    out[athlete] = buildSheetCommentFactsForAthlete({
      athlete,
      measures: args.measures,
      datasets: args.datasets,
    })
  }
  return out
}

const columnMentioned = (text: string, column: string, language: AppLanguage): boolean => {
  const hay = fold(text)
  const col = fold(column)
  if (col.length >= 3 && hay.includes(col)) return true
  const label = fold(displayColumnLabel(column, language))
  if (label.length >= 3 && hay.includes(label)) return true
  const parts = col.split(/[_\s.-]+/).filter((part) => part.length >= 3)
  return parts.some((part) => hay.includes(part))
}

export const commentCitesImputedValue = (args: {
  text: string
  athlete: string
  datasets: Iterable<PremiumDataset>
  language?: AppLanguage
}): string | null => {
  const language = args.language === 'en' ? 'en' : 'fr'
  const needle = fold(args.athlete)
  for (const dataset of args.datasets) {
    const athleteCol = pickAthleteColumn(dataset.columns)
    if (!athleteCol) continue
    for (let rowIndex = 0; rowIndex < dataset.rows.length; rowIndex += 1) {
      const row = dataset.rows[rowIndex] ?? {}
      if (fold(String(row[athleteCol] ?? '')) !== needle) continue
      for (const column of dataset.columns) {
        if (!isImputedCell(dataset, rowIndex, column)) continue
        const value = toNumber(row[column])
        if (value === null) continue
        const valueRe = new RegExp(
          `(?<![A-Za-z0-9_])${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`
        )
        if (!valueRe.test(args.text)) continue
        if (!columnMentioned(args.text, column, language)) continue
        return `forbidden: cites imputed/sentinel value ${value} for ${column}`
      }
    }
  }
  return null
}

export const gateSheetCommentAgainstFacts = (args: {
  text: string
  facts: SheetCommentFact[]
}): string | null => {
  const masked = args.text.replace(DATE_MASK_RE, ' ')
  const rangeHits: Array<{ lo: number; hi: number; raw: string }> = []
  RANGE_RE.lastIndex = 0
  let rangeMatch: RegExpExecArray | null
  while ((rangeMatch = RANGE_RE.exec(masked)) !== null) {
    const lo = parseLocalized(rangeMatch[1] ?? '')
    const hi = parseLocalized(rangeMatch[2] ?? '')
    if (lo === null || hi === null) continue
    rangeHits.push({ lo, hi, raw: rangeMatch[0] })
  }
  for (const hit of rangeHits) {
    if (!valueInFacts(hit.lo, args.facts) || !valueInFacts(hit.hi, args.facts)) {
      return `forbidden: range ${hit.raw} requires both bounds as sheet facts`
    }
  }
  let rangeMasked = masked
  for (const hit of rangeHits) {
    rangeMasked = rangeMasked.replace(hit.raw, ' ')
  }
  NUMBER_RE.lastIndex = 0
  let numMatch: RegExpExecArray | null
  while ((numMatch = NUMBER_RE.exec(rangeMasked)) !== null) {
    const value = parseLocalized(numMatch[1] ?? '')
    if (value === null) continue
    if (valueInFacts(value, args.facts)) continue
    return `forbidden: ungrounded number ${numMatch[1]} — cite sheet facts only`
  }
  return null
}
