export type ReportBriefSignal = {
  athlete?: string
  athleteId?: string
  domains: string[]
  level: 'watch' | 'review' | 'info'
  summary: string
  metrics: Record<string, string | number>
}

export type ReportBriefSection = {
  id: string
  title: string
  kind: 'team' | 'athlete' | 'cross' | 'coverage'
  athleteId?: string
  athleteName?: string
  bullets: string[]
  chartHints: string[]
  tableHints: string[]
}

export type ReportBrief = {
  title: string
  period: { from: string; to: string }
  focus: string
  narrative: string[]
  signals: ReportBriefSignal[]
  sections: ReportBriefSection[]
}

export const emptyReportBrief = (
  period: { from: string; to: string },
  title = 'Staff report'
): ReportBrief => ({
  title,
  period,
  focus: '',
  narrative: [],
  signals: [],
  sections: [],
})

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(asString).filter((x): x is string => Boolean(x)) : []

const asLevel = (value: unknown): ReportBriefSignal['level'] => {
  if (value === 'watch' || value === 'review' || value === 'info') return value
  return 'info'
}

const asKind = (value: unknown): ReportBriefSection['kind'] => {
  if (value === 'team' || value === 'athlete' || value === 'cross' || value === 'coverage') {
    return value
  }
  return 'team'
}

const parseSignal = (raw: unknown): ReportBriefSignal | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const summary = asString(obj.summary)
  if (!summary) return null
  const domains = asStringArray(obj.domains)
  const metrics: Record<string, string | number> = {}
  if (obj.metrics && typeof obj.metrics === 'object' && !Array.isArray(obj.metrics)) {
    for (const [key, val] of Object.entries(obj.metrics as Record<string, unknown>)) {
      if (typeof val === 'string' || typeof val === 'number') metrics[key] = val
    }
  }
  return {
    athlete: asString(obj.athlete) ?? undefined,
    athleteId: asString(obj.athleteId) ?? undefined,
    domains,
    level: asLevel(obj.level),
    summary,
    metrics,
  }
}

const parseSection = (raw: unknown): ReportBriefSection | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const title = asString(obj.title)
  if (!title) return null
  return {
    id: asString(obj.id) ?? title.toLowerCase().replace(/\s+/g, '-').slice(0, 40),
    title,
    kind: asKind(obj.kind),
    athleteId: asString(obj.athleteId) ?? undefined,
    athleteName: asString(obj.athleteName) ?? undefined,
    bullets: asStringArray(obj.bullets),
    chartHints: asStringArray(obj.chartHints),
    tableHints: asStringArray(obj.tableHints),
  }
}

export const parseReportBrief = (raw: unknown): ReportBrief | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const period = obj.period as { from?: unknown; to?: unknown } | undefined
  const from = asString(period?.from)
  const to = asString(period?.to)
  const title = asString(obj.title)
  if (!from || !to || !title) return null

  const signals = Array.isArray(obj.signals)
    ? obj.signals.map(parseSignal).filter((x): x is ReportBriefSignal => Boolean(x))
    : []
  const sections = Array.isArray(obj.sections)
    ? obj.sections.map(parseSection).filter((x): x is ReportBriefSection => Boolean(x))
    : []

  return {
    title,
    period: { from, to },
    focus: asString(obj.focus) ?? '',
    narrative: asStringArray(obj.narrative),
    signals,
    sections,
  }
}

export const synthesizeReportBriefFromDocument = (args: {
  title: string
  period: { from: string; to: string }
  headings: string[]
  textBullets: string[]
}): ReportBrief => ({
  title: args.title || 'Staff report',
  period: args.period,
  focus: 'Staff overview',
  narrative: args.textBullets.slice(0, 6),
  signals: args.textBullets.slice(0, 5).map((summary) => ({
    domains: [],
    level: 'info' as const,
    summary,
    metrics: {},
  })),
  sections: args.headings.slice(0, 12).map((title, i) => ({
    id: `sec-${i + 1}`,
    title,
    kind: 'team' as const,
    bullets: [],
    chartHints: [],
    tableHints: [],
  })),
})
