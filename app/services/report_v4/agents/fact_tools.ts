import type { PremiumTool } from '#services/premium_report/premium_report_tools'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import {
  computeFactValue,
  isValidFactId,
  projectFactsForDesign,
  upsertFact,
  type ReportFactOp,
  type ReportFactWhere,
} from '#services/report_v4/report_facts'

const readWhere = (raw: unknown): ReportFactWhere | undefined => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const column = typeof row.column === 'string' ? row.column.trim() : ''
  const op = typeof row.op === 'string' ? row.op.trim() : ''
  if (!column || !['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(op)) return undefined
  if (
    typeof row.value !== 'string' &&
    typeof row.value !== 'number' &&
    typeof row.value !== 'boolean'
  ) {
    return undefined
  }
  return { column, op: op as ReportFactWhere['op'], value: row.value }
}

export const createReportFactTools = (run: ReportV4RunState): PremiumTool[] => [
  {
    schema: {
      name: 'list_report_facts',
      description:
        'List named facts already computed in code (id/unit/label only — values are injected into HTML at finalize via data-fact spans).',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async () =>
      JSON.stringify({
        ok: true,
        facts: projectFactsForDesign(run.facts.values()),
        hint: 'Cite facts in Designer HTML as <span data-fact="fact.id"></span> — never write the numeric literal.',
      }),
  },
  {
    schema: {
      name: 'compute_report_fact',
      description:
        'Compute a named fact in code from a Linker dataset (count/sum/mean/min/max/distinct/count_where). Value is stored server-side for finalize data-fact injection.',
      input_schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Stable id like ck.over_1000_count (dot-separated slug)',
          },
          datasetId: { type: 'string' },
          op: {
            type: 'string',
            enum: ['count', 'count_where', 'sum', 'mean', 'min', 'max', 'distinct'],
          },
          column: { type: 'string' },
          unit: { type: 'string' },
          label: { type: 'string' },
          where: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              op: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] },
              value: {},
            },
          },
          filter: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              op: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] },
              value: {},
            },
          },
        },
        required: ['id', 'datasetId', 'op'],
      },
    },
    execute: async (input) => {
      const id = typeof input.id === 'string' ? input.id.trim() : ''
      const datasetId = typeof input.datasetId === 'string' ? input.datasetId.trim() : ''
      const op = typeof input.op === 'string' ? (input.op.trim() as ReportFactOp) : null
      if (!id || !isValidFactId(id)) {
        return JSON.stringify({
          error: 'invalid fact id',
          hint: 'Use slug form like ck.over_1000_count',
        })
      }
      if (
        !op ||
        !['count', 'count_where', 'sum', 'mean', 'min', 'max', 'distinct'].includes(op)
      ) {
        return JSON.stringify({ error: 'invalid op' })
      }
      const dataset = run.agentState.datasets.get(datasetId)
      if (!dataset) {
        return JSON.stringify({
          error: 'dataset not found',
          available: [...run.agentState.datasets.keys()].slice(0, 40),
        })
      }
      const where = readWhere(input.where)
      const filter = readWhere(input.filter)
      const column = typeof input.column === 'string' ? input.column.trim() : undefined
      const computed = computeFactValue({
        dataset,
        op,
        column,
        where,
        filter,
      })
      if (!computed.ok) return JSON.stringify({ error: computed.error })
      const fact = {
        id,
        value: computed.value,
        sourceDatasetId: datasetId,
        op,
        ...(column ? { column } : {}),
        ...(where ? { where } : {}),
        ...(filter ? { filter } : {}),
        ...(typeof input.unit === 'string' && input.unit.trim()
          ? { unit: input.unit.trim() }
          : {}),
        ...(typeof input.label === 'string' && input.label.trim()
          ? { label: input.label.trim() }
          : {}),
      }
      upsertFact(run.facts, fact)
      return JSON.stringify({
        ok: true,
        id: fact.id,
        value: fact.value,
        unit: fact.unit ?? null,
        sourceDatasetId: fact.sourceDatasetId,
        span: `<span data-fact="${fact.id}"></span>`,
      })
    },
  },
]
