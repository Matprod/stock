import type {
  ArtifactCoverageResult,
  ArtifactEnvelope,
  ArtifactHarvestResult,
} from '#services/report_v4/artifact_runtime/types'
import type { ReportBrief } from '#services/report_v4/report_brief'

export const countSoftMutations = (args: {
  editorialRemoved: number
  tocAdded: boolean
  emptyStripped: number
  syncedProse: number
  syncedTables: number
  injectedHostShells: number
  injectedProse: number
  injectedSections: number
  injectedTables: number
  injectedCharts: number
  recoStripped: number
  sheetsRebuilt: number
  chartOptionsPatched: number
  designApplied?: string[]
}): { applied: string[]; appliedCount: number } => {
  const applied: string[] = []
  if (args.editorialRemoved > 0) applied.push(`remove_sections:${args.editorialRemoved}`)
  if (args.tocAdded) applied.push('ensure_toc')
  if (args.emptyStripped > 0) applied.push(`strip_empty:${args.emptyStripped}`)
  if (args.syncedProse > 0) applied.push(`synced_prose:${args.syncedProse}`)
  if (args.syncedTables > 0) applied.push(`synced_tables:${args.syncedTables}`)
  if (args.injectedHostShells > 0) applied.push(`host_shells:${args.injectedHostShells}`)
  if (args.injectedProse > 0) applied.push(`injected_prose:${args.injectedProse}`)
  if (args.injectedSections > 0) applied.push(`injected_sections:${args.injectedSections}`)
  if (args.injectedTables > 0) applied.push(`injected_tables:${args.injectedTables}`)
  if (args.injectedCharts > 0) applied.push(`injected_charts:${args.injectedCharts}`)
  if (args.recoStripped > 0) applied.push(`reco_stripped:${args.recoStripped}`)
  if (args.sheetsRebuilt > 0) applied.push(`sheets_rebuilt:${args.sheetsRebuilt}`)
  if (args.chartOptionsPatched > 0) applied.push(`chart_options:${args.chartOptionsPatched}`)
  for (const design of args.designApplied ?? []) applied.push(`design:${design}`)
  return { applied, appliedCount: applied.length }
}

const seriesNamesFromOption = (option: unknown): string[] => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return []
  const names: string[] = []
  const raw = option as Record<string, unknown>
  if (Array.isArray(raw.series)) {
    for (const entry of raw.series) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
      const name = (entry as { name?: unknown }).name
      if (typeof name === 'string' && name.trim()) names.push(name.trim())
    }
  }
  const legend = raw.legend
  if (legend && typeof legend === 'object' && !Array.isArray(legend)) {
    const data = (legend as { data?: unknown }).data
    if (Array.isArray(data)) {
      for (const row of data) {
        if (typeof row === 'string' && row.trim()) names.push(row.trim())
        else if (row && typeof row === 'object' && !Array.isArray(row)) {
          const name = (row as { name?: unknown }).name
          if (typeof name === 'string' && name.trim()) names.push(name.trim())
        }
      }
    }
  }
  const dataset = raw.dataset
  if (dataset && typeof dataset === 'object' && !Array.isArray(dataset)) {
    const source = (dataset as { source?: unknown }).source
    if (Array.isArray(source) && source.length >= 2 && Array.isArray(source[0])) {
      const header = (source[0] as unknown[]).map((col) => String(col ?? ''))
      const athleteIdx = header.findIndex((col) => /^(joueur|athlete|player)$/i.test(col))
      if (athleteIdx >= 0) {
        for (const row of source.slice(1)) {
          if (!Array.isArray(row)) continue
          const cell = row[athleteIdx]
          if (typeof cell === 'string' && cell.trim()) names.push(cell.trim())
        }
      }
    }
  }
  return names
}

const athletesFromOptionMeta = (option: unknown): string[] => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return []
  const raw = option as Record<string, unknown>
  const names: string[] = []
  const meta = raw.mauna ?? raw._mauna
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const athletes = (meta as { athletes?: unknown }).athletes
    if (Array.isArray(athletes)) {
      for (const row of athletes) {
        if (typeof row === 'string' && row.trim()) names.push(row.trim())
      }
    }
  }
  const encode = raw.encode
  if (encode && typeof encode === 'object' && !Array.isArray(encode)) {
    const athletes = (encode as { athletes?: unknown }).athletes
    if (Array.isArray(athletes)) {
      for (const row of athletes) {
        if (typeof row === 'string' && row.trim()) names.push(row.trim())
      }
    }
  }
  return names
}

export const listCoveredAthleteNames = (
  document: {
    blocks: Array<{
      type: string
      title?: string
      text?: string
      option?: unknown
      columns?: string[]
      rows?: Array<Array<string | number | null>>
    }>
  },
  rosterNames: string[]
): string[] => {
  if (!rosterNames.length) return []
  const titleHay = document.blocks
    .map((b) => `${String(b.title ?? '')}\n${String(b.text ?? '')}`)
    .join('\n')
  const seriesHay = document.blocks
    .flatMap((b) => [...seriesNamesFromOption(b.option), ...athletesFromOptionMeta(b.option)])
    .join('\n')
  const tableHay = document.blocks
    .filter((b) => b.type === 'table')
    .map((b) => {
      const cols = (b.columns ?? []).join(' ')
      const cells = (b.rows ?? [])
        .slice(0, 40)
        .map((row) => row.join(' '))
        .join(' ')
      return `${cols}\n${cells}`
    })
    .join('\n')
  const hay = `${titleHay}\n${seriesHay}\n${tableHay}`.toLowerCase()
  const covered: string[] = []
  for (const name of rosterNames) {
    const n = name.trim()
    if (n.length < 2) continue
    if (hay.includes(n.toLowerCase())) covered.push(n)
  }
  return covered
}

export const coverageGateMessage = (
  requiredOrCoverage:
    | number
    | Pick<ArtifactCoverageResult, 'required' | 'delivered' | 'missing' | 'missingDetails'>,
  deliveredMaybe?: number,
  language: 'fr' | 'en' = 'en'
): string => {
  const fr = language === 'fr'
  if (typeof requiredOrCoverage === 'number') {
    const required = requiredOrCoverage
    const delivered = deliveredMaybe ?? 0
    return fr
      ? `Couverture athletes incomplete: ${delivered}/${required} joueurs absents du rapport — chaque joueur absent doit avoir une fiche ou un motif de fiche courte.`
      : `Athlete coverage incomplete: ${delivered}/${required} players missing from the report — each absent player needs a sheet or short-sheet reason.`
  }
  const { required, delivered, missing, missingDetails = [] } = requiredOrCoverage
  const detail =
    missingDetails.length > 0
      ? missingDetails.map((row) => `${row.athlete} (${row.reason})`).join('; ')
      : (missing ?? [])
          .map((name) => (fr ? `${name} (fiche manquante)` : `${name} (missing sheet)`))
          .join('; ')
  return fr
    ? `Couverture athletes incomplete: ${delivered}/${required} joueurs. Manquants: ${detail}. Les fiches courtes qui indiquent l'absence de donnees comptent comme livrees — seuls les joueurs totalement absents bloquent la porte.`
    : `Athlete coverage incomplete: ${delivered}/${required} players. Missing: ${detail}. Short sheets that state no data count as delivered — only fully absent players block the gate.`
}

export const evaluateCoverageGate = (
  document: {
    blocks: Array<{ type: string; title?: string; text?: string; option?: unknown }>
  },
  envelope: ArtifactEnvelope
): ArtifactCoverageResult | null => {
  if (
    (envelope.contracts.athleteCoverage !== 'all' &&
      envelope.contracts.athleteCoverage !== 'named') ||
    envelope.coverage.requiredNames.length === 0
  ) {
    return null
  }
  const covered = listCoveredAthleteNames(document, envelope.coverage.requiredNames)
  const required = envelope.coverage.requiredNames.length
  const delivered = covered.length
  const missing = envelope.coverage.requiredNames.filter((n) => !covered.includes(n))
  return {
    required,
    delivered,
    covered,
    missing,
    missingDetails: missing.map((athlete) => ({
      athlete,
      reason: 'missing sheet — no heading or short-sheet reason in the report',
    })),
    ok: delivered >= required,
  }
}

export const annotateBriefCoverageShortfall = (
  brief: ReportBrief | null,
  coverage: ArtifactCoverageResult,
  language: 'fr' | 'en' = 'en'
): ReportBrief | null => {
  if (coverage.ok || !brief) return brief
  const fr = language === 'fr'
  const detail =
    coverage.missingDetails.length > 0
      ? coverage.missingDetails.map((row) => `${row.athlete}: ${row.reason}`).join('; ')
      : coverage.missing
          .map((name) => (fr ? `${name}: fiche manquante` : `${name}: missing sheet`))
          .join('; ')
  const shortfallNote = fr
    ? `Couverture insuffisante: ${coverage.delivered}/${coverage.required} joueurs — manquants ${detail}. Les fiches courtes avec motif d absence comptent comme livrees.`
    : `Coverage shortfall: ${coverage.delivered}/${coverage.required} players — missing ${detail}. Short sheets with a no-data reason count as delivered.`
  return {
    ...brief,
    narrative: [...brief.narrative, shortfallNote],
    focus: brief.focus
      ? fr
        ? `${brief.focus} (couverture effectif incomplete: ${coverage.missing.join(', ')})`
        : `${brief.focus} (incomplete roster coverage: ${coverage.missing.join(', ')})`
      : fr
        ? `Couverture effectif incomplete: ${coverage.missing.join(', ')}`
        : `Incomplete roster coverage: ${coverage.missing.join(', ')}`,
  }
}

export const verifyAcwrHarvest = (
  state: {
    datasets: Map<string, { columns: string[]; rows: unknown[] }>
    toolHistory: Array<{ name: string }>
  },
  requiredMetrics: string[]
): ArtifactHarvestResult => {
  if (!requiredMetrics.includes('acwr_ewma')) {
    return {
      status: 'ok',
      ok: true,
      missing: [],
      triedLoadSummary: true,
      hasAcwrColumn: true,
      emptyDeclared: false,
    }
  }
  const triedLoadSummary = state.toolHistory.some((row) => row.name === 'build_load_summary')
  const hasAcwrColumn = [...state.datasets.values()].some(
    (dataset) =>
      dataset.columns.some((col) => /acwr_ewma/i.test(col)) && dataset.rows.length > 0
  )
  if (!triedLoadSummary) {
    return {
      status: 'pending',
      ok: false,
      missing: ['build_load_summary'],
      triedLoadSummary: false,
      hasAcwrColumn: false,
      emptyDeclared: false,
    }
  }
  if (hasAcwrColumn) {
    return {
      status: 'ok',
      ok: true,
      missing: [],
      triedLoadSummary: true,
      hasAcwrColumn: true,
      emptyDeclared: false,
    }
  }
  return {
    status: 'empty_declared',
    ok: true,
    missing: [],
    triedLoadSummary: true,
    hasAcwrColumn: false,
    emptyDeclared: true,
  }
}

export const acwrHarvestNudge = (harvest: ArtifactHarvestResult): string | null => {
  if (harvest.status !== 'pending') return null
  return `ACWR contract requires build_load_summary (column acwr_ewma). Still missing: ${harvest.missing.join(', ')}. Call build_load_summary on the Load lookback window, then end_turn.`
}
