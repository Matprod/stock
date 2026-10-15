import { readFileSync } from 'node:fs'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import { designKitPath } from '#services/report_v4/free_designer/kit_paths'

export type FreeDesignerReference = {
  id: string
  filename: string
  bodyHtml: string
  briefHint: string
}

export type SelectReferencesArgs = {
  domains: string[]
  individualSheets: boolean
  hasLongTable?: boolean
  multiSection?: boolean
  pageCountHint?: number
  language?: string
}

const MAX_REFERENCES = 2

const BRIEF_HINTS: Record<string, string> = {
  '00-cover': 'Cover with title, period, three key lines, audience and confidentiality.',
  '02-summary':
    'Headline naming the finding, three KPIs, athletes to watch as cards with a sparkline and a trend chip, three findings, the reliability strip.',
  '03-team-matrix':
    'Sorted rows, athletes of interest in bold, team mean row, scale legend; split across two pages above 24 athletes.',
  '04-load-acwr':
    'Two charts side by side with their own axes, then a scatter that relates two measures, then a callout when data contradicts intuition.',
  '05-positions':
    'Four small sorted bar charts in a 2 × 2 grid with the team mean, then deviation bars beside two findings.',
  '06-wellness':
    'Small multiples for the six highest athletes, then a distribution strip; missing indicators named in one line.',
  '07-availability':
    'Stacked daily status beside three KPIs, the absence timeline, the current injuries table.',
  '08-match':
    'Minutes as sorted bars with the athlete of interest in ink, the physical table beside, three findings.',
  '09-player-sheet':
    'KPI strip, the main chart with direct labels and an annotation, two tables side by side, the two-column note.',
  '10-data-method':
    'Coverage table with status, model drivers as bars, definitions, the not-produced note.',
  '11-appendix-table': 'Long table grouped and sorted, with a repeated header on each page.',
}

const stripDocumentChrome = (html: string): string => {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (body?.[1]) return body[1].trim()
  return html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?html\b[^>]*>/gi, '')
    .replace(/<head\b[\s\S]*?<\/head>/gi, '')
    .trim()
}

const loadReference = (id: string, langDir: 'en' | 'fr'): FreeDesignerReference => {
  const filename = `${id}.html`
  const raw = readFileSync(designKitPath('references', langDir, filename), 'utf8')
  return {
    id,
    filename,
    bodyHtml: stripDocumentChrome(raw),
    briefHint: BRIEF_HINTS[id] ?? id,
  }
}

const domainSet = (domains: string[]) => new Set(domains.map((d) => d.trim().toLowerCase()))

export const selectFreeDesignerReferences = (
  args: SelectReferencesArgs
): FreeDesignerReference[] => {
  const langDir: 'en' | 'fr' = args.language === 'fr' ? 'fr' : 'en'
  const domains = domainSet(args.domains)
  const selected: string[] = ['02-summary']

  const candidates: string[] = []
  if (domains.has(PREMIUM_DOMAIN.SCORES)) candidates.push('03-team-matrix')
  if (domains.has(PREMIUM_DOMAIN.LOAD)) candidates.push('04-load-acwr')
  if (domains.has(PREMIUM_DOMAIN.GPS)) candidates.push('05-positions')
  if (domains.has(PREMIUM_DOMAIN.WELLNESS) || domains.has(PREMIUM_DOMAIN.SLEEP)) {
    candidates.push('06-wellness')
  }
  if (domains.has(PREMIUM_DOMAIN.INJURY)) candidates.push('07-availability')
  if (domains.has(PREMIUM_DOMAIN.MATCH)) candidates.push('08-match')
  if (args.individualSheets) candidates.push('09-player-sheet')

  const wantsLongReport =
    Boolean(args.multiSection) ||
    (typeof args.pageCountHint === 'number' && args.pageCountHint >= 4)
  if (wantsLongReport) {
    candidates.push('00-cover', '10-data-method')
  }
  if (args.hasLongTable) candidates.push('11-appendix-table')

  for (const id of candidates) {
    if (selected.includes(id)) continue
    if (selected.length >= MAX_REFERENCES) break
    if (id === '00-cover' || id === '10-data-method') {
      const other = id === '00-cover' ? '10-data-method' : '00-cover'
      const need = 1 + (selected.includes(other) ? 0 : 1)
      if (selected.length + need > MAX_REFERENCES) continue
      if (!selected.includes('00-cover')) selected.push('00-cover')
      if (selected.length < MAX_REFERENCES && !selected.includes('10-data-method')) {
        selected.push('10-data-method')
      }
      continue
    }
    selected.push(id)
  }

  return selected.slice(0, MAX_REFERENCES).map((id) => loadReference(id, langDir))
}
