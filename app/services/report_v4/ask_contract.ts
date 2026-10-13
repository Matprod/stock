import { PREMIUM_DOMAIN, type PremiumDomain } from '#constants/premium_report_domains'
import type { PremiumReportDocument } from '#contracts/premium_report'
import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'
import { listCoveredAthleteNames } from '#services/report_v4/artifact_runtime/gates'
import type { CoachPromptPolicy } from '#services/report_v4/coach_policy_heuristic'
import { REPORT_V4_DOMAIN_ALIASES } from '#services/report_v4/report_v4_constants'
import type { AppLanguage } from '#utils/localize'

export type AskDeliveryStatus = 'delivered' | 'partial' | 'missing'

export type AskRequirementKind =
  | 'period'
  | 'domain_included'
  | 'domain_excluded'
  | 'metric'
  | 'athletes'
  | 'section_order'
  | 'charts'
  | 'thresholds'

export type AskRequirement = {
  id: string
  kind: AskRequirementKind
  labelFr: string
  labelEn: string
  expected: string
}

export type AskRequirementResult = AskRequirement & {
  status: AskDeliveryStatus
  reasonFr?: string
  reasonEn?: string
}

export type AskContractReport = {
  status: AskDeliveryStatus
  results: AskRequirementResult[]
  message: string
}

const DOMAIN_LABEL: Record<PremiumDomain, { fr: string; en: string }> = {
  [PREMIUM_DOMAIN.LOAD]: { fr: 'charge', en: 'load' },
  [PREMIUM_DOMAIN.GPS]: { fr: 'GPS', en: 'GPS' },
  [PREMIUM_DOMAIN.MATCH]: { fr: 'match', en: 'match' },
  [PREMIUM_DOMAIN.WELLNESS]: { fr: 'wellness', en: 'wellness' },
  [PREMIUM_DOMAIN.SLEEP]: { fr: 'sommeil', en: 'sleep' },
  [PREMIUM_DOMAIN.VALD]: { fr: 'tests de force', en: 'force tests' },
  [PREMIUM_DOMAIN.BIOMARKERS]: { fr: 'biomarqueurs', en: 'biomarkers' },
  [PREMIUM_DOMAIN.BODY]: { fr: 'composition corporelle', en: 'body composition' },
  [PREMIUM_DOMAIN.SCORES]: { fr: 'scores', en: 'scores' },
  [PREMIUM_DOMAIN.INJURY]: { fr: 'blessures', en: 'injuries' },
}

const documentHaystack = (document: PremiumReportDocument): string => {
  const parts: string[] = [document.title]
  for (const block of document.blocks) {
    if (block.type === 'heading' || block.type === 'text') parts.push(block.text)
    if (block.type === 'chart' || block.type === 'table') {
      if (block.title) parts.push(block.title)
    }
    if (block.type === 'chart' && block.option) {
      parts.push(JSON.stringify(block.option).slice(0, 4000))
    }
  }
  return parts.join('\n').toLowerCase()
}

const domainAliases = (domain: PremiumDomain): string[] => {
  const row = REPORT_V4_DOMAIN_ALIASES.find((entry) => entry.domain === domain)
  return row?.aliases ?? [domain]
}

const BIOMARKER_LINKER_COLUMNS_RE =
  /\bbiomarkers?\b|\bck_(?:valeur|value)\b|\bcreatine[_\s-]?kinase\b|\bferritin\b|\bcortisol\b|\bhemoglobin\b/i

const domainMentioned = (hay: string, domain: PremiumDomain): boolean => {
  if (domain === PREMIUM_DOMAIN.BIOMARKERS) {
    return BIOMARKER_LINKER_COLUMNS_RE.test(hay)
  }
  const aliases = domainAliases(domain)
  return aliases.some((alias) => {
    if (alias === 'ck' || alias === 'lab') return false
    try {
      return new RegExp(alias, 'i').test(hay)
    } catch {
      return hay.includes(alias.toLowerCase())
    }
  })
}

const headingTexts = (document: PremiumReportDocument): string[] =>
  document.blocks
    .filter((block) => block.type === 'heading')
    .map((block) => block.text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

const bandTitlesFromHtml = (html: string): string[] => {
  const titles: string[] = []
  const bandRe =
    /<div\b[^>]*class=["'][^"']*(?<![-\w])band(?![-\w])[^"']*["'][^>]*>[\s\S]*?<\/div>/gi
  for (const match of html.matchAll(bandRe)) {
    const chunk = match[0] ?? ''
    const heading =
      chunk.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ??
      chunk.match(/class=["'][^"']*\bband-title\b[^"']*["'][^>]*>([\s\S]*?)</i)?.[1] ??
      ''
    const plain = heading
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (plain) titles.push(plain)
  }
  return titles
}

const orderMatchesTitles = (titles: string[], expected: string[]): boolean => {
  if (expected.length < 2) return true
  const heads = titles.map((title) => title.toLowerCase())
  if (heads.length < 2) return false
  let cursor = -1
  let matched = 0
  for (const section of expected) {
    const needle = section.trim().toLowerCase()
    if (needle.length < 2) continue
    const idx = heads.findIndex((title, i) => i > cursor && title.includes(needle))
    if (idx < 0) continue
    cursor = idx
    matched += 1
  }
  return matched >= Math.min(2, expected.filter((s) => s.trim().length >= 2).length)
}

const sectionOrderOk = (
  document: PremiumReportDocument,
  expected: string[],
  html?: string | null
): boolean => {
  if (expected.length < 2) return true
  if (orderMatchesTitles(headingTexts(document), expected)) return true
  if (html && orderMatchesTitles(bandTitlesFromHtml(html), expected)) return true
  return false
}

const markLineValuesInDocument = (document: PremiumReportDocument): number[] => {
  const values: number[] = []
  for (const block of document.blocks) {
    if (block.type !== 'chart') continue
    const option = block.option as Record<string, unknown>
    const yAxis = option.yAxis
    const axes = Array.isArray(yAxis) ? yAxis : yAxis ? [yAxis] : []
    for (const axis of axes) {
      if (!axis || typeof axis !== 'object') continue
      const lines = (axis as { markLine?: { data?: unknown } }).markLine?.data
      if (!Array.isArray(lines)) continue
      for (const line of lines) {
        if (typeof line === 'number') values.push(line)
        else if (line && typeof line === 'object') {
          const yAxisIndex = (line as { yAxis?: unknown }).yAxis
          if (typeof yAxisIndex === 'number') values.push(yAxisIndex)
          else if (Array.isArray(line) && typeof line[0] === 'number') values.push(line[0])
        }
      }
    }
  }
  return values
}

const metricPresent = (hay: string, metric: string): boolean => {
  const key = metric.trim().toLowerCase()
  if (!key) return false
  if (hay.includes(key)) return true
  if (key === 'acwr_ewma') return /\bacwr\b/i.test(hay)
  return false
}

export const buildAskRequirements = (args: {
  displayRange: { from: string; to: string }
  policy: CoachPromptPolicy
  envelope: ArtifactEnvelope
  domains: PremiumDomain[]
  minCharts?: number
}): AskRequirement[] => {
  const reqs: AskRequirement[] = []
  reqs.push({
    id: 'period',
    kind: 'period',
    labelFr: 'Période',
    labelEn: 'Period',
    expected: `${args.displayRange.from} → ${args.displayRange.to}`,
  })

  for (const domain of args.policy.preferredDomains.length
    ? args.policy.preferredDomains
    : args.domains) {
    const label = DOMAIN_LABEL[domain]
    reqs.push({
      id: `domain_in:${domain}`,
      kind: 'domain_included',
      labelFr: `Domaine inclus · ${label.fr}`,
      labelEn: `Included domain · ${label.en}`,
      expected: domain,
    })
  }

  for (const domain of args.policy.excludedDomains) {
    const label = DOMAIN_LABEL[domain]
    reqs.push({
      id: `domain_out:${domain}`,
      kind: 'domain_excluded',
      labelFr: `Domaine exclu · ${label.fr}`,
      labelEn: `Excluded domain · ${label.en}`,
      expected: domain,
    })
  }

  for (const metric of args.envelope.contracts.requiredMetrics) {
    reqs.push({
      id: `metric:${metric}`,
      kind: 'metric',
      labelFr: `Métrique · ${metric}`,
      labelEn: `Metric · ${metric}`,
      expected: metric,
    })
  }

  if (
    args.envelope.coverage.requiredNames.length > 0 &&
    (args.envelope.contracts.athleteCoverage === 'all' ||
      args.envelope.contracts.athleteCoverage === 'named')
  ) {
    reqs.push({
      id: 'athletes',
      kind: 'athletes',
      labelFr: 'Joueurs demandés',
      labelEn: 'Requested athletes',
      expected: args.envelope.coverage.requiredNames.join(', '),
    })
  }

  if (args.policy.sectionOrder.length >= 2) {
    reqs.push({
      id: 'section_order',
      kind: 'section_order',
      labelFr: 'Ordre des sections',
      labelEn: 'Section order',
      expected: args.policy.sectionOrder.join(' → '),
    })
  }

  const minCharts = args.minCharts ?? 0
  if (minCharts > 0) {
    reqs.push({
      id: 'charts',
      kind: 'charts',
      labelFr: 'Graphiques / tableaux',
      labelEn: 'Charts / tables',
      expected: String(minCharts),
    })
  }

  const thresholds = args.envelope.contracts.vizOps.find((op) => op.kind === 'mark_lines')
  if (thresholds && thresholds.kind === 'mark_lines' && thresholds.values.length) {
    reqs.push({
      id: 'thresholds',
      kind: 'thresholds',
      labelFr: 'Seuils',
      labelEn: 'Thresholds',
      expected: thresholds.values.join(', '),
    })
  }

  return reqs
}

export const verifyAskContract = (args: {
  requirements: AskRequirement[]
  document: PremiumReportDocument
  envelope: ArtifactEnvelope
  acwrStatus?: 'ok' | 'pending' | 'empty_declared' | null
  language: AppLanguage
  htmlArtifact?: string | null
}): AskContractReport => {
  const hay = documentHaystack(args.document)
  const chartCount = args.document.blocks.filter((b) => b.type === 'chart').length
  const tableCount = args.document.blocks.filter((b) => b.type === 'table').length
  const results: AskRequirementResult[] = []

  for (const req of args.requirements) {
    if (req.kind === 'period') {
      const ok =
        args.document.dateRange.from === req.expected.split(' → ')[0] &&
        args.document.dateRange.to === req.expected.split(' → ')[1]
      results.push({
        ...req,
        status: ok ? 'delivered' : 'partial',
        reasonFr: ok
          ? undefined
          : `Période livrée : ${args.document.dateRange.from} → ${args.document.dateRange.to}`,
        reasonEn: ok
          ? undefined
          : `Delivered period: ${args.document.dateRange.from} → ${args.document.dateRange.to}`,
      })
      continue
    }

    if (req.kind === 'domain_included') {
      const domain = req.expected as PremiumDomain
      const ok = domainMentioned(hay, domain)
      results.push({
        ...req,
        status: ok ? 'delivered' : 'missing',
        reasonFr: ok ? undefined : `Peu ou pas de contenu sur ${DOMAIN_LABEL[domain].fr}`,
        reasonEn: ok ? undefined : `Little or no content for ${DOMAIN_LABEL[domain].en}`,
      })
      continue
    }

    if (req.kind === 'domain_excluded') {
      const domain = req.expected as PremiumDomain
      const present = domainMentioned(hay, domain)
      results.push({
        ...req,
        status: present ? 'missing' : 'delivered',
        reasonFr: present
          ? `Le domaine ${DOMAIN_LABEL[domain].fr} apparaît encore dans le rapport`
          : undefined,
        reasonEn: present
          ? `Domain ${DOMAIN_LABEL[domain].en} still appears in the report`
          : undefined,
      })
      continue
    }

    if (req.kind === 'metric') {
      let status: AskDeliveryStatus = metricPresent(hay, req.expected) ? 'delivered' : 'missing'
      let reasonFr: string | undefined
      let reasonEn: string | undefined
      if (req.expected === 'acwr_ewma' && args.acwrStatus === 'empty_declared') {
        status = 'missing'
        reasonFr = 'Pas de données de charge pour calculer l’ACWR sur cette période'
        reasonEn = 'No load data to compute ACWR for this window'
      } else if (req.expected === 'acwr_ewma' && args.acwrStatus === 'pending') {
        status = 'missing'
        reasonFr = 'Collecte de charge incomplète pour l’ACWR'
        reasonEn = 'Load harvest incomplete for ACWR'
      } else if (status === 'missing') {
        reasonFr = `Métrique ${req.expected} absente du rapport`
        reasonEn = `Metric ${req.expected} missing from the report`
      }
      results.push({ ...req, status, reasonFr, reasonEn })
      continue
    }

    if (req.kind === 'athletes') {
      const names = args.envelope.coverage.requiredNames
      const covered = listCoveredAthleteNames(args.document, names)
      const status: AskDeliveryStatus =
        covered.length >= names.length
          ? 'delivered'
          : covered.length > 0
            ? 'partial'
            : 'missing'
      const missing = names.filter((name) => !covered.includes(name))
      results.push({
        ...req,
        status,
        reasonFr:
          status === 'delivered'
            ? undefined
            : `Joueurs manquants : ${missing.slice(0, 8).join(', ') || 'aucun trouvé'}`,
        reasonEn:
          status === 'delivered'
            ? undefined
            : `Missing athletes: ${missing.slice(0, 8).join(', ') || 'none found'}`,
      })
      continue
    }

    if (req.kind === 'section_order') {
      const expected = req.expected.split(/\s*→\s*/).map((s) => s.trim()).filter(Boolean)
      const ok = sectionOrderOk(args.document, expected, args.htmlArtifact)
      results.push({
        ...req,
        status: ok ? 'delivered' : 'partial',
        reasonFr: ok ? undefined : 'L’ordre des sections ne suit pas la demande',
        reasonEn: ok ? undefined : 'Section order does not match the ask',
      })
      continue
    }

    if (req.kind === 'charts') {
      const min = Number(req.expected) || 0
      const total = chartCount + tableCount
      const status: AskDeliveryStatus =
        total >= min ? 'delivered' : total > 0 ? 'partial' : 'missing'
      results.push({
        ...req,
        status,
        reasonFr:
          status === 'delivered'
            ? undefined
            : `${total} graphique(s)/tableau(x) au lieu de ${min} demandés`,
        reasonEn:
          status === 'delivered'
            ? undefined
            : `${total} chart(s)/table(s) instead of ${min} requested`,
      })
      continue
    }

    if (req.kind === 'thresholds') {
      const wanted = req.expected
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((n) => Number.isFinite(n))
      const present = markLineValuesInDocument(args.document)
      const hit = wanted.filter((value) =>
        present.some((row) => Math.abs(row - value) < 0.05)
      )
      const status: AskDeliveryStatus =
        hit.length >= wanted.length
          ? 'delivered'
          : hit.length > 0
            ? 'partial'
            : 'missing'
      results.push({
        ...req,
        status,
        reasonFr:
          status === 'delivered'
            ? undefined
            : `Seuils manquants : ${wanted.filter((v) => !hit.includes(v)).join(', ')}`,
        reasonEn:
          status === 'delivered'
            ? undefined
            : `Missing thresholds: ${wanted.filter((v) => !hit.includes(v)).join(', ')}`,
      })
      continue
    }

    results.push({ ...req, status: 'delivered' })
  }

  const missing = results.filter((row) => row.status === 'missing').length
  const partial = results.filter((row) => row.status === 'partial').length
  const status: AskDeliveryStatus =
    missing === 0 && partial === 0 ? 'delivered' : missing === results.length ? 'missing' : 'partial'

  const message = formatAskContractMessage({
    status,
    results,
    language: args.language,
  })

  return { status, results, message }
}

export const formatAskContractMessage = (args: {
  status: AskDeliveryStatus
  results: AskRequirementResult[]
  language: AppLanguage
}): string => {
  const fr = args.language !== 'en'
  const gaps = args.results.filter((row) => row.status !== 'delivered')
  if (args.status === 'delivered' && gaps.length === 0) {
    return fr ? 'Rapport livré : tout ce qui était demandé est présent.' : 'Report delivered: everything asked for is present.'
  }
  const lines = gaps.slice(0, 6).map((row) => {
    const label = fr ? row.labelFr : row.labelEn
    const reason = fr ? row.reasonFr : row.reasonEn
    const tag =
      row.status === 'partial'
        ? fr
          ? 'partiel'
          : 'partial'
        : fr
          ? 'non livré'
          : 'not delivered'
    return reason ? `${label} (${tag}) — ${reason}` : `${label} (${tag})`
  })
  const head =
    args.status === 'partial'
      ? fr
        ? 'Rapport partiel :'
        : 'Partial report:'
      : fr
        ? 'Rapport incomplet :'
        : 'Incomplete report:'
  return `${head} ${lines.join(' · ')}`
}

export const evaluateAskContract = (args: {
  document: PremiumReportDocument
  displayRange: { from: string; to: string }
  policy: CoachPromptPolicy
  envelope: ArtifactEnvelope
  domains: PremiumDomain[]
  language: AppLanguage
  acwrStatus?: 'ok' | 'pending' | 'empty_declared' | null
  minCharts?: number
  htmlArtifact?: string | null
}): AskContractReport => {
  const requirements = buildAskRequirements({
    displayRange: args.displayRange,
    policy: args.policy,
    envelope: args.envelope,
    domains: args.domains,
    minCharts: args.minCharts,
  })
  return verifyAskContract({
    requirements,
    document: args.document,
    envelope: args.envelope,
    acwrStatus: args.acwrStatus,
    language: args.language,
    htmlArtifact: args.htmlArtifact,
  })
}
