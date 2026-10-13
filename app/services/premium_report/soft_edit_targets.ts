import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumDomain } from '#constants/premium_report_domains'
import type { PremiumReportBlock, PremiumReportDocument } from '#contracts/premium_report'
import { canvasAthleteNames } from '#services/premium_report/canvas_athletes'
import { asSeriesList } from '#services/premium_report/charts/echarts_types'
import { foldAscii } from '#utils/html_text'

const blockSearchText = (block: PremiumReportBlock): string => {
  if (block.type === PREMIUM_BLOCK_TYPE.CHART) return foldAscii(block.title ?? '')
  if (block.type === PREMIUM_BLOCK_TYPE.TABLE) return foldAscii(block.title ?? '')
  if (block.type === PREMIUM_BLOCK_TYPE.HEADING) return foldAscii(block.text ?? '')
  return foldAscii(block.text ?? '')
}

const athletesNamedInPrompt = (promptFolded: string, document: PremiumReportDocument): string[] => {
  const onCanvas = canvasAthleteNames(document.blocks)
  return onCanvas.filter((name) => {
    const folded = foldAscii(name)
    if (folded.length < 4) return false
    if (promptFolded.includes(folded)) return true
    const parts = folded.split(/\s+/).filter((part) => part.length >= 4)
    return parts.length >= 2 && parts.every((part) => promptFolded.includes(part))
  })
}

const chartMentionsAthlete = (block: PremiumReportBlock, athleteFolded: string): boolean => {
  if (block.type !== PREMIUM_BLOCK_TYPE.CHART) return false
  const title = foldAscii(block.title ?? '')
  if (title.includes(athleteFolded)) return true
  const parts = athleteFolded.split(/\s+/).filter((part) => part.length >= 4)
  if (parts.length >= 2 && parts.every((part) => title.includes(part))) return true
  const series = asSeriesList(block.option.series)
  return series.some((entry) => {
    const name = typeof entry.name === 'string' ? foldAscii(entry.name) : ''
    if (!name) return false
    if (name.includes(athleteFolded) || athleteFolded.includes(name)) return true
    return parts.length >= 2 && parts.every((part) => name.includes(part))
  })
}

const titleOrHostMatch = (promptFolded: string, block: PremiumReportBlock): boolean => {
  const label = blockSearchText(block)
  if (
    label.length >= 4 &&
    (promptFolded.includes(label) || label.includes(promptFolded.slice(0, 48)))
  ) {
    return true
  }
  if (label.length < 4) return false
  const tokens = promptFolded
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
  if (tokens.length < 2) return false
  return tokens.filter((token) => label.includes(token)).length >= Math.min(2, tokens.length)
}

const blockMatchesAskDomain = (label: string, domains: PremiumDomain[]): boolean =>
  domains.some((domain) => {
    const key = foldAscii(domain)
    return key.length >= 3 && (label.includes(key) || label.includes(key.replace(/_/g, ' ')))
  })

export type SoftEditTargetsOpts = {
  askDomains?: PremiumDomain[]
}

export const resolveSoftEditTargets = (
  prompt: string,
  document: PremiumReportDocument,
  opts?: SoftEditTargetsOpts
): string[] => {
  const folded = foldAscii(prompt)
  if (!folded.trim() || document.blocks.length === 0) return []

  const askDomains = opts?.askDomains ?? []
  const matched = new Set<string>()

  for (const block of document.blocks) {
    if (titleOrHostMatch(folded, block)) matched.add(block.id)
  }

  if (matched.size === 0 && askDomains.length > 0) {
    for (const block of document.blocks) {
      const label = blockSearchText(block)
      if (!label) continue
      if (blockMatchesAskDomain(label, askDomains)) matched.add(block.id)
    }
  }

  const namedAthletes = athletesNamedInPrompt(folded, document)
  if (namedAthletes.length > 0 && matched.size > 0) {
    const athleteHits = new Set<string>()
    for (const name of namedAthletes) {
      const needle = foldAscii(name)
      for (const block of document.blocks) {
        if (!matched.has(block.id)) continue
        if (chartMentionsAthlete(block, needle)) athleteHits.add(block.id)
      }
    }
    if (athleteHits.size > 0) {
      return document.blocks.filter((block) => athleteHits.has(block.id)).map((block) => block.id)
    }
  }

  return document.blocks.filter((block) => matched.has(block.id)).map((block) => block.id)
}

export const softEditBlockTitle = (block: PremiumReportBlock | undefined): string => {
  if (!block) return ''
  if (block.type === PREMIUM_BLOCK_TYPE.CHART) return block.title ?? ''
  if (block.type === PREMIUM_BLOCK_TYPE.TABLE) return block.title ?? ''
  if (block.type === PREMIUM_BLOCK_TYPE.HEADING) return block.text ?? ''
  return block.text.slice(0, 80)
}

export const listSoftTargetCandidates = (
  prompt: string,
  document: PremiumReportDocument,
  limit = 8,
  opts?: SoftEditTargetsOpts
): Array<{ id: string; title: string }> => {
  const folded = foldAscii(prompt)
  const askDomains = opts?.askDomains ?? []
  const scored: Array<{ id: string; title: string; score: number }> = []
  for (const block of document.blocks) {
    if (block.type !== PREMIUM_BLOCK_TYPE.CHART && block.type !== PREMIUM_BLOCK_TYPE.TABLE) {
      continue
    }
    const title = softEditBlockTitle(block).trim()
    if (!title) continue
    let score = 1
    const label = foldAscii(title)
    if (askDomains.length > 0 && blockMatchesAskDomain(label, askDomains)) score += 3
    const tokens = folded
      .split(/[^a-z0-9]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length >= 4)
    score += tokens.filter((token) => label.includes(token)).length
    scored.push({ id: block.id, title, score })
  }
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  const seen = new Set<string>()
  const out: Array<{ id: string; title: string }> = []
  for (const row of scored) {
    const key = row.title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ id: row.id, title: row.title })
    if (out.length >= limit) break
  }
  return out
}
