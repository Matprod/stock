import type { PremiumDataset } from '#contracts/premium_report'
import type { ReportFact } from '#services/report_v4/report_facts'
import type { FreeDesignerReference } from '#services/report_v4/free_designer/select_references'

export const DESIGNER_INPUT_SOFT_TOKENS = 150_000
export const DESIGNER_INPUT_HARD_TOKENS = 180_000

export const estimateTokens = (text: string): number => Math.ceil(Math.max(0, text.length) / 4)

export type DesignerPromptPartSizes = {
  systemPrompt: number
  brief: number
  theme: number
  references: Array<{ id: string; chars: number; tokens: number }>
  referencesTotal: number
  coachPrompt: number
  askContract: number
  facts: number
  datasets: number
  variableSuffix: number
  fixedPrefix: number
  total: number
}

export type DesignerBudgetInput = {
  systemPrompt: string
  brief: string
  theme: string
  references: FreeDesignerReference[]
  coachPrompt: string
  askContractJson: string
  facts: Array<Pick<ReportFact, 'id' | 'value' | 'unit'>>
  datasets: PremiumDataset[]
}

export type DesignerBudgetResult = {
  references: FreeDesignerReference[]
  facts: Array<Pick<ReportFact, 'id' | 'value' | 'unit'>>
  datasets: PremiumDataset[]
  parts: DesignerPromptPartSizes
  trimmed: string[]
  withinSoftLimit: boolean
  withinHardLimit: boolean
}

export const lightenReferenceHtml = (html: string): string => {
  let next = html
  next = next.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  next = next.replace(/<link\b[^>]*>/gi, '')
  next = next.replace(/@font-face\s*\{[\s\S]*?\}/gi, '')
  next = next.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '<svg data-chart-placeholder="1"></svg>')
  next = next.replace(/\sstyle=(["'])[\s\S]*?\1/gi, '')
  next = next.replace(/\sclass=(["'])[^"']*\1/gi, (full) => {
    if (/\b(page|band|kpi|card|figcaption|legend|table|report-table)\b/i.test(full)) return full
    return ''
  })
  next = next.replace(/\n{3,}/g, '\n\n').trim()
  if (next.length > 6_000) next = `${next.slice(0, 6_000)}\n<!-- truncated -->`
  return next
}

export const compactDatasetForDesigner = (
  dataset: PremiumDataset,
  maxRows: number
): PremiumDataset => {
  const rows = dataset.rows.length <= maxRows ? dataset.rows : dataset.rows.slice(0, maxRows)
  return {
    id: dataset.id,
    columns: dataset.columns,
    rows,
    units: dataset.units,
    labels: dataset.labels,
    dateRange: dataset.dateRange,
    domain: dataset.domain,
  }
}

const measureParts = (args: {
  systemPrompt: string
  brief: string
  theme: string
  references: FreeDesignerReference[]
  coachPrompt: string
  askContractJson: string
  factsJson: string
  datasetsJson: string
}): DesignerPromptPartSizes => {
  const references = args.references.map((ref) => {
    const body = `${ref.briefHint}\n${ref.bodyHtml}`
    return { id: ref.id, chars: body.length, tokens: estimateTokens(body) }
  })
  const referencesTotal = references.reduce((sum, row) => sum + row.tokens, 0)
  const brief = estimateTokens(args.brief)
  const theme = estimateTokens(args.theme)
  const fixedPrefix = brief + theme + referencesTotal
  const coachPrompt = estimateTokens(args.coachPrompt)
  const askContract = estimateTokens(args.askContractJson)
  const facts = estimateTokens(args.factsJson)
  const datasets = estimateTokens(args.datasetsJson)
  const variableSuffix = coachPrompt + askContract + facts + datasets
  const systemPrompt = estimateTokens(args.systemPrompt)
  return {
    systemPrompt,
    brief,
    theme,
    references,
    referencesTotal,
    coachPrompt,
    askContract,
    facts,
    datasets,
    variableSuffix,
    fixedPrefix,
    total: systemPrompt + fixedPrefix + variableSuffix,
  }
}

const citedFactIds = (args: {
  coachPrompt: string
  askContractJson: string
  facts: Array<Pick<ReportFact, 'id' | 'value' | 'unit'>>
}): Set<string> => {
  const hay = `${args.coachPrompt}\n${args.askContractJson}`
  const keep = new Set<string>()
  for (const fact of args.facts) {
    if (hay.includes(fact.id)) keep.add(fact.id)
  }
  return keep
}

export const fitDesignerPromptBudget = (input: DesignerBudgetInput): DesignerBudgetResult => {
  const trimmed: string[] = []
  if (input.references.length > 2) trimmed.push('references_cap:2')
  let references = input.references.slice(0, 2).map((ref) => {
    const light = lightenReferenceHtml(ref.bodyHtml)
    if (light.length < ref.bodyHtml.length) trimmed.push(`ref_light:${ref.id}`)
    return { ...ref, bodyHtml: light }
  })
  let facts = [...input.facts]
  let maxRows = Math.max(40, ...input.datasets.map((ds) => ds.rows.length), 40)
  let datasets = input.datasets.map((ds) => compactDatasetForDesigner(ds, maxRows))

  const rebuild = () => {
    const factsJson = JSON.stringify(facts)
    const datasetsJson = JSON.stringify(
      datasets.map((ds) => ({
        id: ds.id,
        columns: ds.columns,
        rows: ds.rows,
        units: ds.units,
        labels: ds.labels,
        dateRange: ds.dateRange,
      }))
    )
    const askContractJson = input.askContractJson
    return measureParts({
      systemPrompt: input.systemPrompt,
      brief: input.brief,
      theme: input.theme,
      references,
      coachPrompt: input.coachPrompt,
      askContractJson,
      factsJson,
      datasetsJson,
    })
  }

  let parts = rebuild()

  while (parts.total > DESIGNER_INPUT_SOFT_TOKENS) {
    if (references.length > 0) {
      references = references.slice(0, Math.max(0, references.length - 1))
      trimmed.push('references')
      parts = rebuild()
      continue
    }
    if (maxRows > 8) {
      maxRows = Math.max(8, Math.floor(maxRows / 2))
      datasets = input.datasets.map((ds) => compactDatasetForDesigner(ds, maxRows))
      trimmed.push(`dataset_rows:${maxRows}`)
      parts = rebuild()
      continue
    }
    if (facts.length > 0) {
      const cited = citedFactIds({
        coachPrompt: input.coachPrompt,
        askContractJson: input.askContractJson,
        facts,
      })
      const next = facts.filter((fact) => cited.has(fact.id))
      if (next.length < facts.length) {
        facts = next
        trimmed.push('uncited_facts')
        parts = rebuild()
        continue
      }
      facts = facts.slice(0, Math.max(0, Math.floor(facts.length / 2)))
      trimmed.push('facts_halved')
      parts = rebuild()
      continue
    }
    break
  }

  if (parts.total > DESIGNER_INPUT_HARD_TOKENS && maxRows > 3) {
    maxRows = 3
    datasets = input.datasets.map((ds) => compactDatasetForDesigner(ds, maxRows))
    trimmed.push('dataset_rows:3')
    parts = rebuild()
  }

  return {
    references,
    facts,
    datasets,
    parts,
    trimmed: [...new Set(trimmed)],
    withinSoftLimit: parts.total <= DESIGNER_INPUT_SOFT_TOKENS,
    withinHardLimit: parts.total <= DESIGNER_INPUT_HARD_TOKENS,
  }
}

export const designerOverflowStaffMessage = (language: 'fr' | 'en'): string =>
  language === 'fr'
    ? "Le rapport n'a pas pu être composé : la demande est trop volumineuse pour être traitée en une seule fois. Réessayez avec une période plus courte ou moins de joueurs."
    : 'The report could not be composed: this request is too large to process in one pass. Try a shorter period or fewer players.'
