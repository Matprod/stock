import { readFileSync } from 'node:fs'
import type { PremiumDataset } from '#contracts/premium_report'
import type { ReportFact } from '#services/report_v4/report_facts'
import { designKitPath } from '#services/report_v4/free_designer/kit_paths'
import type { FreeDesignerReference } from '#services/report_v4/free_designer/select_references'
import {
  fitDesignerPromptBudget,
  type DesignerPromptPartSizes,
} from '#services/report_v4/free_designer/prompt_budget'

export type FreeDesignerFixedPrefixArgs = {
  language?: string
  references: FreeDesignerReference[]
  brief?: string
  theme?: string
}

export type FreeDesignerVariableSuffixArgs = {
  askContract?: unknown
  coachPrompt: string
  facts:
    | Iterable<ReportFact>
    | Map<string, ReportFact>
    | Array<Pick<ReportFact, 'id' | 'value' | 'unit'>>
  datasets: Iterable<PremiumDataset> | Map<string, PremiumDataset> | PremiumDataset[]
  displayRange: { from: string; to: string }
  clubName: string
  language?: string
}

export type FreeDesignerPromptBundle = {
  fixedPrefix: string
  variableSuffix: string
  references: FreeDesignerReference[]
  parts: DesignerPromptPartSizes
  trimmed: string[]
  withinHardLimit: boolean
}

const loadBriefMd = (): string => readFileSync(designKitPath('brief.md'), 'utf8')

const loadThemeCss = (): string => readFileSync(designKitPath('theme.css'), 'utf8')

const projectFacts = (
  facts: FreeDesignerVariableSuffixArgs['facts']
): Array<Record<string, unknown>> => {
  const list = Array.isArray(facts)
    ? facts
    : facts instanceof Map
      ? [...facts.values()]
      : [...facts]
  return list.map((fact) => {
    const row = fact as ReportFact & { id: string; value: number; unit?: string }
    return {
      id: row.id,
      value: row.value,
      unit: row.unit,
      ...(row.op ? { op: row.op, nature: row.op } : {}),
      ...(row.column ? { column: row.column } : {}),
      ...(row.label ? { label: row.label } : {}),
    }
  })
}

const listDatasets = (datasets: FreeDesignerVariableSuffixArgs['datasets']): PremiumDataset[] => {
  if (Array.isArray(datasets)) return datasets
  return datasets instanceof Map ? [...datasets.values()] : [...datasets]
}

export const buildFreeDesignerFixedPrefix = (args: FreeDesignerFixedPrefixArgs): string => {
  const brief = (args.brief ?? loadBriefMd()).trim()
  const theme = (args.theme ?? loadThemeCss()).trim()
  const refs = args.references
    .map(
      (ref) =>
        `<reference name="${ref.id}" note="exemple, données fictives">\n${ref.briefHint}\n${ref.bodyHtml}\n</reference>`
    )
    .join('\n\n')
  return [
    '# Art direction brief',
    brief,
    '',
    '# theme.css',
    theme,
    '',
    '# References (examples, fictional data — do not copy names or values)',
    refs || '(none)',
  ].join('\n')
}

export const buildFreeDesignerVariableSuffix = (args: FreeDesignerVariableSuffixArgs): string => {
  const language = args.language === 'fr' ? 'fr' : 'en'
  const facts = projectFacts(args.facts)
  const datasets = listDatasets(args.datasets).map((ds) => ({
    id: ds.id,
    columns: ds.columns,
    rows: ds.rows,
    units: ds.units,
    labels: ds.labels,
    dateRange: ds.dateRange,
  }))
  return [
    '# Request',
    `Club: ${args.clubName}`,
    `Language: ${language} (write all prose in this language; ignore UI/HTTP language)`,
    `Display period: ${args.displayRange.from} → ${args.displayRange.to}`,
    'Fact nature: use each fact op (mean/max/sum/last/…) and period verbatim in titles and captions.',
    '',
    '## Coach prompt',
    args.coachPrompt.trim(),
    '',
    '## Ask contract',
    JSON.stringify(args.askContract ?? null),
    '',
    '## Facts (id, value, unit)',
    JSON.stringify(facts),
    '',
    '## Datasets (compact JSON)',
    JSON.stringify(datasets),
  ].join('\n')
}

export const FREE_DESIGNER_SYSTEM_PROMPT = [
  'You are the MAUNA staff-report Designer.',
  'Write free HTML page bodies (div.page) for an A4 PDF using only theme.css variables and classes.',
  'Write every title, lede, finding, caption and suggestion in the Language given in the request (French or English). Do not follow the app UI language.',
  'Call chart_svg for charts; commit pages with set_report_pages in small batches (1–3 div.page per call).',
  'First batch: mode=replace. Later batches: mode=append. Set done=true on the last batch.',
  'Never send the entire multi-page report in one tool call — that hits max_tokens and truncates.',
  'Each set_report_pages call must contain only new pages (append) or a full restart (replace on empty); never resend earlier pages.',
  'Never invent numbers. Use data-fact ids from Facts. Never include planche, apercu, or references/src.',
  'Column names, measure ids and football positions stay in English humanized form (e.g. Central defender) — never translate positions or metrics.',
  'Every fact and chart title must state its nature and period exactly as computed (mean / max / total / single-day value). Never call a max a mean or a daily peak a cumulative load.',
  'When a ranking chart omits players with no data, add a legend note such as “3 players without GPS data”.',
  'Do not write <head>, @font-face, scripts, or CDN links — the server assembles the document.',
  'Empty chart/table/section → one localized “unavailable” line with the reason — never an empty frame.',
  'Out-of-MAUNA asks (e.g. drink recipes) → one clear unavailable line, no invented content.',
].join(' ')

export const FREE_DESIGNER_CONTINUE =
  'Pages incomplete. Call set_report_pages with 1–3 div.page bodies (mode=replace if none yet, else mode=append). Use chart_svg for charts. Set done=true when finished.'

export const buildFreeDesignerUserPrompt = (args: {
  fixedPrefix: string
  variableSuffix: string
}): string => `${args.fixedPrefix}\n\n---\n\n${args.variableSuffix}`

export const buildBudgetedFreeDesignerPrompt = (args: {
  language?: string
  references: FreeDesignerReference[]
  askContract?: unknown
  coachPrompt: string
  facts: Iterable<ReportFact> | Map<string, ReportFact>
  datasets: Iterable<PremiumDataset> | Map<string, PremiumDataset>
  displayRange: { from: string; to: string }
  clubName: string
  systemPrompt?: string
}): FreeDesignerPromptBundle => {
  const brief = loadBriefMd()
  const theme = loadThemeCss()
  const systemPrompt = args.systemPrompt ?? FREE_DESIGNER_SYSTEM_PROMPT
  const askContractJson = JSON.stringify(args.askContract ?? null)
  const fitted = fitDesignerPromptBudget({
    systemPrompt,
    brief,
    theme,
    references: args.references,
    coachPrompt: args.coachPrompt,
    askContractJson,
    facts: projectFacts(args.facts),
    datasets: listDatasets(args.datasets),
  })

  const fixedPrefix = buildFreeDesignerFixedPrefix({
    language: args.language,
    references: fitted.references,
    brief,
    theme,
  })
  const variableSuffix = buildFreeDesignerVariableSuffix({
    askContract: args.askContract,
    coachPrompt: args.coachPrompt,
    facts: fitted.facts,
    datasets: fitted.datasets,
    displayRange: args.displayRange,
    clubName: args.clubName,
    language: args.language,
  })

  return {
    fixedPrefix,
    variableSuffix,
    references: fitted.references,
    parts: fitted.parts,
    trimmed: fitted.trimmed,
    withinHardLimit: fitted.withinHardLimit,
  }
}
