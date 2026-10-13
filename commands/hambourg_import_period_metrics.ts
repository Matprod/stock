import { STATSSPORTS_PERIOD_METRICS_FILE } from '#constants/hambourg.constants'
import {
  METRIC_AGGREGATION_METHOD,
  METRIC_DATA_TYPE,
  type MetricAggregationMethod,
  type MetricDataType,
} from '#constants/metrics.constants'
import PeriodMetric from '#models_pg/period_metric'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type PeriodMetricCsvRow = {
  id: string
  name: string
  description: string | null
  dataType: MetricDataType
  aggregationMethod: MetricAggregationMethod
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

function parseDataType(value: string): MetricDataType | null {
  const normalized = value.trim().toLowerCase()
  return (Object.values(METRIC_DATA_TYPE) as string[]).includes(normalized)
    ? (normalized as MetricDataType)
    : null
}

function parseAggregationMethod(value: string): MetricAggregationMethod | null {
  const normalized = value.trim().toLowerCase()
  return (Object.values(METRIC_AGGREGATION_METHOD) as string[]).includes(normalized)
    ? (normalized as MetricAggregationMethod)
    : null
}

function parsePeriodMetricsCsv(filePath: string): PeriodMetricCsvRow[] {
  const content = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const header = parseCsvLine(lines[0], ';').map((cell) => cell.toLowerCase())
  const indexOf = (name: string) => header.indexOf(name)
  const idIdx = indexOf('metric_id')
  const nameIdx = indexOf('name')
  const descriptionIdx = indexOf('description')
  const dataTypeIdx = indexOf('data_type')
  const aggregationIdx = indexOf('aggregation_method')

  if (idIdx < 0 || dataTypeIdx < 0 || aggregationIdx < 0) {
    throw new Error('CSV must include metric_id, data_type and aggregation_method')
  }

  const rows: PeriodMetricCsvRow[] = []
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line, ';')
    const id = (cells[idIdx] ?? '').trim()
    const dataType = parseDataType(cells[dataTypeIdx] ?? '')
    const aggregationMethod = parseAggregationMethod(cells[aggregationIdx] ?? '')
    if (!id || !dataType || !aggregationMethod) continue

    const description = (cells[descriptionIdx] ?? '').trim()
    rows.push({
      id,
      name: (cells[nameIdx] ?? '').trim(),
      description: description.length > 0 ? description : null,
      dataType,
      aggregationMethod,
    })
  }

  return rows
}

export default class HambourgImportPeriodMetrics extends BaseCommand {
  static commandName = 'hambourg:import-period-metrics'
  static description =
    'Update period_metrics description/dataType/aggregationMethod from statsports_period_metrics_db.csv'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Path to period metrics CSV',
    default: STATSSPORTS_PERIOD_METRICS_FILE,
  })
  declare file: string

  @flags.boolean({
    description: 'Preview updates without writing',
  })
  declare dryRun: boolean

  @flags.number({
    description: 'Number of sample updates to print',
    default: 20,
  })
  declare show: number

  async run() {
    const filePath = this.file.startsWith('/')
      ? this.file
      : join(process.cwd(), this.file.replace(/^\.\//, ''))

    const rows = parsePeriodMetricsCsv(filePath)
    const metrics = await PeriodMetric.query().whereIn(
      'id',
      rows.map((row) => row.id)
    )
    const metricById = new Map(metrics.map((metric) => [metric.id, metric]))

    let descriptionUpdated = 0
    let dataTypeUpdated = 0
    let aggregationUpdated = 0
    let unchanged = 0
    let missing = 0
    const samples: string[] = []
    const missingIds: string[] = []

    for (const row of rows) {
      const metric = metricById.get(row.id)
      if (!metric) {
        missing++
        missingIds.push(`${row.name || '—'} ${row.id}`)
        continue
      }

      const updates: Partial<
        Pick<PeriodMetric, 'description' | 'dataType' | 'aggregationMethod'>
      > = {}
      if (metric.description !== row.description) {
        updates.description = row.description
        descriptionUpdated++
      }
      if (metric.dataType !== row.dataType) {
        updates.dataType = row.dataType
        dataTypeUpdated++
      }
      if (metric.aggregationMethod !== row.aggregationMethod) {
        updates.aggregationMethod = row.aggregationMethod
        aggregationUpdated++
      }

      if (Object.keys(updates).length === 0) {
        unchanged++
        continue
      }

      if (samples.length < this.show) {
        samples.push(
          `${metric.name}: desc=${row.description ?? '—'} type=${metric.dataType}→${row.dataType} agg=${metric.aggregationMethod ?? '—'}→${row.aggregationMethod}`
        )
      }

      if (!this.dryRun) {
        metric.merge(updates)
        await metric.save()
      }
    }

    console.log('')
    console.log(`Period metrics CSV: ${filePath}${this.dryRun ? ' (dry-run)' : ''}`)
    console.log(`Rows: ${rows.length}`)
    console.log(`Matched period_metrics: ${metrics.length}`)
    console.log(`Missing metrics: ${missing}`)
    console.log(
      `Updated: description=${descriptionUpdated} dataType=${dataTypeUpdated} aggregationMethod=${aggregationUpdated} unchanged=${unchanged}`
    )

    if (samples.length > 0) {
      console.log('')
      console.log(`Samples (showing ${samples.length})`)
      for (const sample of samples) {
        console.log(`  - ${sample}`)
      }
    }

    if (missingIds.length > 0) {
      console.log('')
      console.log(`Missing (showing ${Math.min(this.show, missingIds.length)}/${missingIds.length})`)
      for (const row of missingIds.slice(0, this.show)) {
        console.log(`  - ${row}`)
      }
    }

    console.log('')

    if (this.dryRun) {
      this.logger.info(
        `Dry run: would update description=${descriptionUpdated} dataType=${dataTypeUpdated} aggregationMethod=${aggregationUpdated}`
      )
    } else {
      this.logger.success(
        `Updated description=${descriptionUpdated} dataType=${dataTypeUpdated} aggregationMethod=${aggregationUpdated}`
      )
    }
  }
}
