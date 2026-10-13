import type { PremiumReportBlock, PremiumReportDocument } from '#contracts/premium_report'
import type { RosterAthlete } from '#services/report_v4/roster_macros'

const foldPosition = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export const clubPositionCatalog = (roster: RosterAthlete[]): string[] => {
  const byFold = new Map<string, string>()
  for (const row of roster) {
    const raw = row.position.trim()
    if (!raw || raw === '—') continue
    const folded = foldPosition(raw)
    if (!folded) continue
    if (!byFold.has(folded)) byFold.set(folded, raw)
  }
  return [...byFold.values()].sort((a, b) => a.localeCompare(b, 'fr'))
}

const clubPositionFoldedSet = (catalog: string[]): Set<string> =>
  new Set(catalog.map(foldPosition).filter(Boolean))

const isClubPositionLabel = (label: unknown, catalogFolded: Set<string>): boolean => {
  const folded = foldPosition(String(label ?? ''))
  if (!folded) return false
  return catalogFolded.has(folded)
}

export const isGenericPositionGapNote = (text: string): boolean =>
  /cat[eé]gorie g[eé]n[eé]rique/i.test(text) ||
  /entr[eé]es vides/i.test(text) ||
  /classification incompl[eè]te/i.test(text)

export const isFakeUnavailableDataNote = (text: string): boolean => {
  const t = text.toLowerCase()
  if (
    /[eé]l[eé]ments?\s+non\s+disponibles|donn[eé]es?\s+manquantes|not available in (the )?current data|unavailable in (the )?current data/.test(
      t
    )
  ) {
    return true
  }
  if (
    /outstanding analysis|data availability|additional requests|requ[eê]tes?\s+(en\s+attente|suppl[eé]mentaires)|disponibilit[eé]\s+des\s+donn[eé]es/.test(
      t
    )
  ) {
    return true
  }
  if (
    /scheduled for (the )?next|will be included in the next|next (full|comprehensive|bi-?weekly)|prochain rapport|archiv(e|ed) monthly|contact medical staff/.test(
      t
    )
  ) {
    return true
  }
  if (
    /recommandation\s*:?\s*(mettre en place|implement).{0,80}(collecte|collection|systematic)/i.test(
      text
    )
  ) {
    return true
  }
  if (
    /(ne sont pas (disponibles|pr[eé]sentes)|pas pr[eé]sent(e|es)? dans (le |les )?jeu|aucune donn[eé]e|require(s)? additional data).{0,120}(gps|wellness|radar|scatter|sommeil|sleep|mood|biomarker|position)/i.test(
      t
    )
  ) {
    return true
  }
  return false
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const looksLikeDateCategory = (value: unknown): boolean => {
  const raw = String(value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(raw) || /^\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?$/.test(raw)
}

const pruneChartOptionPositions = (
  option: Record<string, unknown>,
  catalogFolded: Set<string>
): Record<string, unknown> => {
  const yAxis = option.yAxis
  const xAxis = option.xAxis
  const yIsCat = isRecord(yAxis) && yAxis.type === 'category' && Array.isArray(yAxis.data)
  const xIsCat = isRecord(xAxis) && xAxis.type === 'category' && Array.isArray(xAxis.data)
  if (yIsCat || xIsCat) {
    const catAxis = (yIsCat ? yAxis : xAxis) as Record<string, unknown>
    const cats = catAxis.data as unknown[]
    const seriesRaw = Array.isArray(option.series) ? option.series : []
    const primary = seriesRaw.find((entry) => isRecord(entry) && Array.isArray(entry.data))
    if (isRecord(primary) && Array.isArray(primary.data) && primary.data.length === cats.length) {
      const isDateAxis = cats.some(looksLikeDateCategory)
      const keepIdx = cats
        .map((cat, i) => (isClubPositionLabel(cat, catalogFolded) ? i : -1))
        .filter((i) => i >= 0)
      if (!isDateAxis && keepIdx.length > 0 && keepIdx.length < cats.length) {
        return {
          ...option,
          [yIsCat ? 'yAxis' : 'xAxis']: { ...catAxis, data: keepIdx.map((i) => cats[i]) },
          series: seriesRaw.map((entry) => {
            if (!isRecord(entry) || !Array.isArray(entry.data)) return entry
            const seriesData = entry.data as unknown[]
            return { ...entry, data: keepIdx.map((i) => seriesData[i]) }
          }),
        }
      }
    }
  }

  const dataset = isRecord(option.dataset) ? option.dataset : null
  const source = dataset && Array.isArray(dataset.source) ? dataset.source : null
  if (source && source.length >= 2 && Array.isArray(source[0])) {
    const header = source[0] as unknown[]
    const posteIdx = header.findIndex((col) => /^(poste|position)$/i.test(String(col)))
    if (posteIdx >= 0) {
      const kept = [header as unknown[]].concat(
        source.slice(1).filter((row) => Array.isArray(row) && isClubPositionLabel(row[posteIdx], catalogFolded)) as unknown[][]
      )
      if (kept.length !== source.length) {
        return { ...option, dataset: { ...dataset, source: kept } }
      }
    }
  }
  return option
}

export const pruneDocumentToClubPositions = (
  document: PremiumReportDocument,
  catalog: string[]
): PremiumReportDocument => {
  const catalogFolded = clubPositionFoldedSet(catalog)
  const blocks: PremiumReportBlock[] = []
  for (const block of document.blocks) {
    if (block.type === 'text' || block.type === 'heading') {
      if (isGenericPositionGapNote(block.text)) continue
      blocks.push(block)
      continue
    }
    if (block.type === 'chart' && block.option) {
      blocks.push({
        ...block,
        option: pruneChartOptionPositions(block.option, catalogFolded),
      })
      continue
    }
    if (block.type === 'table') {
      const posteIdx = block.columns.findIndex((col) => /^(poste|position)$/i.test(col))
      if (posteIdx < 0) {
        blocks.push(block)
        continue
      }
      const rows = block.rows.filter((row) => isClubPositionLabel(row[posteIdx], catalogFolded))
      if (rows.length === 0) continue
      blocks.push({ ...block, rows })
      continue
    }
    blocks.push(block)
  }
  return { ...document, blocks }
}
