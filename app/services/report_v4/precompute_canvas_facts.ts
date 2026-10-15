import type { PremiumDataset, PremiumReportDocument } from '#contracts/premium_report'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import {
  computeFactValue,
  isValidFactId,
  upsertFact,
  type ReportFact,
  type ReportFactOp,
} from '#services/report_v4/report_facts'
import logger from '@adonisjs/core/services/logger'

const IDENTITY_COL_RE =
  /^(joueur|player|athlete|athlete_id|name|nom|date_of_day|date|poste|position|unit|n|jersey_number|gender|biomarker|metric)$/i

const CANVAS_OPS: ReportFactOp[] = ['mean', 'sum', 'delta']

const slugPart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)

const factIdFor = (datasetId: string, column: string, op: ReportFactOp): string => {
  const id = `${slugPart(datasetId)}.${slugPart(column)}.${op}`
  return id
}

const numericColumns = (dataset: PremiumDataset): string[] => {
  return dataset.columns.filter((column) => {
    if (IDENTITY_COL_RE.test(column)) return false
    let hits = 0
    for (const row of dataset.rows.slice(0, 40)) {
      const raw = row[column]
      if (raw == null || raw === '') continue
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
      if (Number.isFinite(n)) hits += 1
    }
    return hits >= 2
  })
}

const columnsUsedInDocument = (document: PremiumReportDocument | null | undefined): Set<string> => {
  const used = new Set<string>()
  if (!document) return used
  for (const block of document.blocks) {
    if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
      for (const column of block.columns) used.add(column)
    }
    if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
      const option = block.option as {
        dataset?: { dimensions?: string[] }
        encode?: { y?: string | string[]; x?: string }
        series?: Array<{ encode?: { y?: string | string[] }; name?: string }>
      }
      for (const dim of option.dataset?.dimensions ?? []) used.add(dim)
      const encodeY = option.encode?.y
      if (typeof encodeY === 'string') used.add(encodeY)
      else if (Array.isArray(encodeY)) for (const y of encodeY) used.add(y)
      for (const series of option.series ?? []) {
        const y = series.encode?.y
        if (typeof y === 'string') used.add(y)
        else if (Array.isArray(y)) for (const col of y) used.add(col)
        if (series.name) used.add(series.name)
      }
      if (block.title) used.add(block.title)
    }
  }
  return used
}

const columnMentioned = (column: string, used: Set<string>): boolean => {
  if (used.size === 0) return true
  const key = column.toLowerCase()
  for (const entry of used) {
    const hay = entry.toLowerCase()
    if (hay === key || hay.includes(key) || key.includes(hay.replace(/\s+/g, '_'))) return true
  }
  return false
}

export const precomputeCanvasFacts = (args: {
  datasets: Iterable<PremiumDataset>
  registry: Map<string, ReportFact>
  document?: PremiumReportDocument | null
  maxFacts?: number
}): { added: number; ids: string[] } => {
  const maxFacts = args.maxFacts ?? 80
  const used = columnsUsedInDocument(args.document)
  const ids: string[] = []
  let added = 0

  for (const dataset of args.datasets) {
    if (!dataset?.id || dataset.rows.length === 0) continue
    if (/^roster$|effectif/i.test(dataset.id)) continue
    for (const column of numericColumns(dataset)) {
      if (!columnMentioned(column, used) && used.size > 0) continue
      for (const op of CANVAS_OPS) {
        if (added >= maxFacts) {
          logger.info({ added, maxFacts }, 'report_v4.precompute_canvas_facts_capped')
          return { added, ids }
        }
        const id = factIdFor(dataset.id, column, op)
        if (!isValidFactId(id)) continue
        if (args.registry.has(id)) continue
        const computed = computeFactValue({ dataset, op, column })
        if (!computed.ok) continue
        const unit = dataset.units?.[column]
        const fact: ReportFact = {
          id,
          value: computed.value,
          sourceDatasetId: dataset.id,
          column,
          op,
          ...(unit ? { unit } : {}),
          label: `${column} ${op}`,
        }
        upsertFact(args.registry, fact)
        ids.push(id)
        added += 1
      }
    }
  }

  if (added > 0) {
    logger.info({ added, sample: ids.slice(0, 8) }, 'report_v4.precompute_canvas_facts')
  }
  return { added, ids }
}
