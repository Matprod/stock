import { parseHTML } from 'linkedom'
import logger from '@adonisjs/core/services/logger'
import type { AppLanguage } from '#utils/localize'
import type { GroundingViolation } from '#services/report_v4/grounding_types'
import { formatFactValue } from '#services/report_v4/report_facts'
import {
  REPORT_V4_REPAIR_ENABLED,
  REPORT_V4_REPAIR_MAX_ROUNDS,
  REPORT_V4_REPAIR_PROSE_DROP_RATIO,
} from '#services/report_v4/report_v4_constants'
import { scanNumbers, type ScanFact } from '#services/report_v4/grounding_tokenizer'

export type RepairVerdict = 'ok' | 'repaired' | 'fallback'

export type RepairOp = {
  code: string
  blockPath: string
  before: string
  after: string
}

export type GroundingIssue = {
  code: string
  message?: string
  evidence?: string
  blockPath?: string
}

export type ModelPatch = {
  blockPath: string
  find: string
  replace: string
}

export type RepairContext = {
  language: AppLanguage
  facts: ScanFact[]
  requiredChartIds: string[]
  maxRounds?: number
  proseDropRatioMax?: number
  reaudit: (html: string) => GroundingIssue[] | Promise<GroundingIssue[]>
  requestModelPatch?: (args: {
    sentences: string[]
    facts: Array<{ id: string; label?: string; formatted: string }>
  }) => Promise<ModelPatch[]>
}

export type RepairReport = {
  verdict: RepairVerdict
  applied: RepairOp[]
  remaining: GroundingIssue[]
  html: string
  rounds: number
  modelCalled: boolean
  durationMs: number
}

const BLOCKING_CODES = new Set([
  'html_unparseable',
  'chart_hosts_absent',
  'prose_drop_ratio',
  'kpi_without_fact',
])

const NBSP_RE = /[\u00a0\u202f\u2009]/g

export const isReportV4RepairEnabled = (): boolean => {
  const raw = process.env.REPORT_V4_REPAIR?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  if (raw === '1' || raw === 'true' || raw === 'on') return true
  return REPORT_V4_REPAIR_ENABLED
}

export const toGroundingIssues = (violations: GroundingViolation[]): GroundingIssue[] =>
  violations.map((v) => ({
    code: v.code,
    message: v.message,
    evidence: v.evidence,
  }))

export const issuesFromMissingChartHosts = (missingIds: string[]): GroundingIssue[] =>
  missingIds.map((id) => ({
    code: 'chart_host_missing',
    message: 'Required chart-box host missing',
    evidence: id,
  }))

export const issuesFromDuplicateChartHosts = (duplicateIds: string[]): GroundingIssue[] =>
  duplicateIds.map((id) => ({
    code: 'chart_host_duplicate',
    message: 'Duplicate chart-box host',
    evidence: id,
  }))

const normalizeComparable = (value: string): string =>
  value.replace(NBSP_RE, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

const wrapHtml = (html: string): string =>
  /<html[\s>]/i.test(html) ? html : `<!DOCTYPE html><html><body>${html}</body></html>`

const serialize = (document: Document): string => {
  const doctype = '<!DOCTYPE html>'
  const html = document.documentElement?.outerHTML
  if (html) return `${doctype}${html}`
  return document.body?.innerHTML ?? ''
}

const isParseable = (html: string): boolean => {
  try {
    const { document } = parseHTML(wrapHtml(html))
    return Boolean(document.body)
  } catch {
    return false
  }
}

const countProseBlocks = (html: string): number => {
  const { document } = parseHTML(wrapHtml(html))
  return document.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, figcaption').length
}

const listChartHostIds = (html: string): string[] => {
  const { document } = parseHTML(wrapHtml(html))
  return [...document.querySelectorAll('.chart-box[id], div.chart-box[id]')].map(
    (el) => el.getAttribute('id') ?? ''
  ).filter(Boolean)
}

export const findMissingChartHosts = (html: string, requiredChartIds: string[]): string[] => {
  const present = new Set(listChartHostIds(html))
  return requiredChartIds.filter((id) => !present.has(id))
}

export const findDuplicateChartHosts = (html: string): string[] => {
  const counts = new Map<string, number>()
  for (const id of listChartHostIds(html)) {
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id)
}

const escapeCssIdent = (id: string): string => id.replace(/([^a-zA-Z0-9_-])/g, '\\$1')

const findFactForLiteral = (
  raw: string,
  facts: ScanFact[],
  language: AppLanguage
): ScanFact | null => {
  const rawNorm = normalizeComparable(raw)
  for (const fact of facts) {
    const rendered = normalizeComparable(formatFactValue(fact.value, language, fact.unit))
    if (rendered === rawNorm) return fact
    const bare = normalizeComparable(formatFactValue(fact.value, language, undefined))
    const rawBare = normalizeComparable(raw.replace(/\s*%$/u, ''))
    if (bare === rawBare) return fact
  }
  return null
}

const canWrapLiteral = (raw: string, fact: ScanFact, language: AppLanguage): boolean => {
  const rendered = formatFactValue(fact.value, language, fact.unit)
  if (normalizeComparable(rendered) === normalizeComparable(raw)) return true
  const bare = formatFactValue(fact.value, language, undefined)
  const rawBare = raw.replace(/\s*%$/u, '').trim()
  if (normalizeComparable(bare) !== normalizeComparable(rawBare)) {
    if ((fact.unit ?? '').toLowerCase() === '%') {
      const pctText = `${formatFactValue(fact.value <= 1 ? fact.value * 100 : fact.value, language, undefined)} %`
      return normalizeComparable(pctText) === normalizeComparable(raw)
    }
    return false
  }
  const recheck = formatFactValue(fact.value, language, fact.unit)
  return (
    normalizeComparable(recheck) === normalizeComparable(raw) ||
    normalizeComparable(`${bare}${fact.unit === '%' ? ' %' : fact.unit ? `\u00a0${fact.unit}` : ''}`) ===
      normalizeComparable(raw) ||
    normalizeComparable(bare) === normalizeComparable(rawBare)
  )
}

const applyWrapFact = (
  html: string,
  raw: string,
  factId: string
): { html: string; op: RepairOp | null } => {
  const { document } = parseHTML(wrapHtml(html))
  const textNodes: Text[] = []
  const visit = (node: Node): void => {
    if (node.nodeType === 3) {
      textNodes.push(node as Text)
      return
    }
    if (node.nodeType !== 1) return
    const el = node as Element
    if (el.hasAttribute?.('data-fact')) return
    const tag = el.tagName?.toUpperCase?.() ?? ''
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TABLE') return
    for (const child of Array.from(el.childNodes)) visit(child)
  }
  visit(document.body ?? document.documentElement)
  const variants = [...new Set([raw, raw.replace(NBSP_RE, ' '), raw.replace(/ /g, '\u00a0')])]
  for (const textNode of textNodes) {
    const content = textNode.textContent ?? ''
    let idx = -1
    let matched = ''
    for (const variant of variants) {
      idx = content.indexOf(variant)
      if (idx >= 0) {
        matched = variant
        break
      }
    }
    if (idx < 0) {
      const loose = content.replace(NBSP_RE, ' ').toLowerCase().indexOf(normalizeComparable(raw))
      if (loose < 0) continue
      idx = loose
      matched = content.slice(loose, loose + raw.length)
      if (!matched) matched = raw
    }
    const before = content.slice(0, idx)
    const after = content.slice(idx + matched.length)
    const span = document.createElement('span')
    span.setAttribute('data-fact', factId)
    span.textContent = ''
    const parent = textNode.parentNode
    if (!parent) continue
    if (before) parent.insertBefore(document.createTextNode(before), textNode)
    parent.insertBefore(span, textNode)
    if (after) parent.insertBefore(document.createTextNode(after), textNode)
    parent.removeChild(textNode)
    return {
      html: serialize(document),
      op: {
        code: 'wrap_fact',
        blockPath: factId,
        before: raw,
        after: `<span data-fact="${factId}"></span>`,
      },
    }
  }
  return { html, op: null }
}

const dropSentenceContaining = (
  html: string,
  needle: string,
  code: string
): { html: string; op: RepairOp | null } => {
  if (!needle.trim()) return { html, op: null }
  const { document } = parseHTML(wrapHtml(html))
  const blocks = [
    ...document.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, figcaption, .callout'),
  ]
  for (const block of blocks) {
    const text = block.textContent ?? ''
    if (!text.toLowerCase().includes(needle.toLowerCase())) continue
    const before = block.outerHTML
    const tag = block.tagName.toLowerCase()
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      block.textContent = block.getAttribute('data-fallback-label') || '—'
      return {
        html: serialize(document),
        op: { code, blockPath: block.getAttribute('data-block') ?? tag, before, after: block.outerHTML },
      }
    }
    const parent = block.parentNode
    parent?.removeChild(block)
    return {
      html: serialize(document),
      op: {
        code,
        blockPath: block.getAttribute('data-block') ?? tag,
        before,
        after: '',
      },
    }
  }
  return { html, op: null }
}

const insertChartHost = (
  html: string,
  chartId: string
): { html: string; op: RepairOp | null } => {
  const { document } = parseHTML(wrapHtml(html))
  if (document.getElementById(chartId)) return { html, op: null }
  const figure = document.createElement('figure')
  figure.className = 'fig'
  figure.setAttribute('data-block', `repair.${chartId}`)
  const box = document.createElement('div')
  box.className = 'chart-box'
  box.id = chartId
  figure.appendChild(box)
  const host =
    document.querySelector('section.page:last-of-type') ??
    document.querySelector('main') ??
    document.body
  if (!host) return { html, op: null }
  host.appendChild(figure)
  return {
    html: serialize(document),
    op: {
      code: 'insert_host',
      blockPath: `repair.${chartId}`,
      before: '',
      after: figure.outerHTML,
    },
  }
}

const dedupeChartHosts = (
  html: string,
  chartId: string
): { html: string; op: RepairOp | null } => {
  const { document } = parseHTML(wrapHtml(html))
  const esc = escapeCssIdent(chartId)
  const nodes = [...document.querySelectorAll(`.chart-box#${esc}, #${esc}.chart-box`)]
  if (nodes.length <= 1) return { html, op: null }
  const removed: string[] = []
  for (const node of nodes.slice(1)) {
    removed.push(node.outerHTML)
    const figure = node.closest('figure')
    ;(figure ?? node).remove()
  }
  return {
    html: serialize(document),
    op: {
      code: 'dedupe_host',
      blockPath: chartId,
      before: removed.join('\n'),
      after: '',
    },
  }
}

const stripForbiddenElements = (html: string): { html: string; ops: RepairOp[] } => {
  const { document } = parseHTML(wrapHtml(html))
  const ops: RepairOp[] = []
  const removeAll = (selector: string, code: string) => {
    for (const el of [...document.querySelectorAll(selector)]) {
      ops.push({
        code,
        blockPath: el.getAttribute('data-block') ?? selector,
        before: el.outerHTML.slice(0, 200),
        after: '',
      })
      el.remove()
    }
  }
  removeAll('script:not([data-mauna-boot])', 'strip_script')
  removeAll('style:not([data-mauna-pack])', 'strip_style')
  removeAll('img[src^="data:"], img.athlete-photo, img[data-athlete]', 'strip_photo')
  return { html: ops.length ? serialize(document) : html, ops }
}

const applyModelPatches = (
  html: string,
  patches: ModelPatch[],
  facts: ScanFact[]
): { html: string; ops: RepairOp[]; rejected: number } => {
  let next = html
  const ops: RepairOp[] = []
  let rejected = 0
  const factIds = new Set(facts.map((f) => f.id))
  for (const patch of patches) {
    if (!patch.find || patch.replace.includes(patch.find) === false && !next.includes(patch.find)) {
      if (!next.includes(patch.find)) {
        rejected += 1
        continue
      }
    }
    if (/\d/.test(patch.replace.replace(/<span\b[^>]*\bdata-fact=["'][^"']+["'][^>]*>\s*<\/span>/gi, ''))) {
      const scan = scanNumbers(`<p>${patch.replace}</p>`, { facts })
      if (scan.ungrounded.length > 0) {
        rejected += 1
        continue
      }
    }
    const unknownFact = [...patch.replace.matchAll(/data-fact=["']([^"']+)["']/gi)].some(
      (m) => !factIds.has(m[1] ?? '')
    )
    if (unknownFact) {
      rejected += 1
      continue
    }
    if (!next.includes(patch.find)) {
      rejected += 1
      continue
    }
    next = next.replace(patch.find, patch.replace)
    ops.push({
      code: 'model_patch',
      blockPath: patch.blockPath,
      before: patch.find,
      after: patch.replace,
    })
  }
  return { html: next, ops, rejected }
}

const classifyAndRepairRound = async (
  html: string,
  issues: GroundingIssue[],
  ctx: RepairContext,
  modelCalledRef: { value: boolean }
): Promise<{ html: string; ops: RepairOp[]; blocking: GroundingIssue[] }> => {
  const ops: RepairOp[] = []
  let next = html
  const blocking: GroundingIssue[] = []

  if (!isParseable(next)) {
    return {
      html: next,
      ops,
      blocking: [{ code: 'html_unparseable', message: 'HTML could not be parsed' }],
    }
  }

  const stripped = stripForbiddenElements(next)
  next = stripped.html
  ops.push(...stripped.ops)

  for (const issue of issues) {
    if (BLOCKING_CODES.has(issue.code)) {
      blocking.push(issue)
      continue
    }

    if (issue.code === 'literal_number' && issue.evidence) {
      const fact = findFactForLiteral(issue.evidence, ctx.facts, ctx.language)
      if (fact && canWrapLiteral(issue.evidence, fact, ctx.language)) {
        const wrapped = applyWrapFact(next, issue.evidence, fact.id)
        if (wrapped.op) {
          next = wrapped.html
          ops.push(wrapped.op)
        }
        continue
      }
      if (fact) {
        continue
      }
      const dropped = dropSentenceContaining(next, issue.evidence, 'drop_sentence')
      if (dropped.op) {
        next = dropped.html
        ops.push(dropped.op)
      }
      continue
    }

    if (issue.code === 'numeric_ungrounded' && issue.evidence) {
      if (ctx.requestModelPatch && !modelCalledRef.value) {
        modelCalledRef.value = true
        const sentences = [issue.evidence]
        const patches = await ctx.requestModelPatch({
          sentences,
          facts: ctx.facts.map((f) => ({
            id: f.id,
            label: f.id,
            formatted: formatFactValue(f.value, ctx.language, f.unit),
          })),
        })
        const applied = applyModelPatches(next, patches, ctx.facts)
        next = applied.html
        ops.push(...applied.ops)
        if (applied.ops.length > 0) continue
      }
      const dropped = dropSentenceContaining(next, issue.evidence, 'drop_sentence')
      if (dropped.op) {
        next = dropped.html
        ops.push(dropped.op)
      }
      continue
    }

    if (issue.code === 'chart_host_missing' && issue.evidence) {
      const inserted = insertChartHost(next, issue.evidence)
      if (inserted.op) {
        next = inserted.html
        ops.push(inserted.op)
      }
      continue
    }

    if (issue.code === 'chart_host_duplicate' && issue.evidence) {
      const deduped = dedupeChartHosts(next, issue.evidence)
      if (deduped.op) {
        next = deduped.html
        ops.push(deduped.op)
      }
      continue
    }

    if (
      issue.code === 'athlete_unknown' ||
      issue.code === 'nutrition_out_of_scope' ||
      issue.code === 'wellness_scale'
    ) {
      const dropped = dropSentenceContaining(next, issue.evidence ?? '', 'drop_sentence')
      if (dropped.op) {
        next = dropped.html
        ops.push(dropped.op)
      }
    }
  }

  return { html: next, ops, blocking }
}

const hasKpiWithoutFact = (html: string): boolean => {
  const { document } = parseHTML(wrapHtml(html))
  for (const kpi of document.querySelectorAll('.kpi, .kpis .kpi')) {
    const hasFact = kpi.querySelector('[data-fact]')
    const text = (kpi.textContent ?? '').replace(NBSP_RE, ' ').trim()
    if (!hasFact && /\d/.test(text)) return true
  }
  return false
}

export const repairHtml = async (
  html: string,
  issues: GroundingIssue[],
  ctx: RepairContext
): Promise<RepairReport> => {
  const started = Date.now()
  const maxRounds = ctx.maxRounds ?? REPORT_V4_REPAIR_MAX_ROUNDS
  const dropRatioMax = ctx.proseDropRatioMax ?? REPORT_V4_REPAIR_PROSE_DROP_RATIO
  const applied: RepairOp[] = []
  let current = html
  let remaining = [...issues]
  let rounds = 0
  const modelCalledRef = { value: false }
  const proseBefore = countProseBlocks(html)

  if (!isParseable(html)) {
    const report: RepairReport = {
      verdict: 'fallback',
      applied,
      remaining: [{ code: 'html_unparseable', message: 'HTML could not be parsed' }],
      html,
      rounds: 0,
      modelCalled: false,
      durationMs: Date.now() - started,
    }
    logger.warn(
      { verdict: report.verdict, rounds: 0, ops: 0, modelCalled: false, durationMs: report.durationMs },
      'report_v4.repair_summary'
    )
    return report
  }

  const initialStrip = stripForbiddenElements(current)
  if (initialStrip.ops.length > 0) {
    current = initialStrip.html
    applied.push(...initialStrip.ops)
  }

  const structural: GroundingIssue[] = [
    ...issuesFromMissingChartHosts(findMissingChartHosts(current, ctx.requiredChartIds)),
    ...issuesFromDuplicateChartHosts(findDuplicateChartHosts(current)),
  ]
  remaining = [...remaining, ...structural]

  while (rounds < maxRounds && remaining.length > 0) {
    rounds += 1
    const round = await classifyAndRepairRound(current, remaining, ctx, modelCalledRef)
    applied.push(...round.ops)
    current = round.html

    if (round.blocking.length > 0) {
      const report: RepairReport = {
        verdict: 'fallback',
        applied,
        remaining: round.blocking,
        html: current,
        rounds,
        modelCalled: modelCalledRef.value,
        durationMs: Date.now() - started,
      }
      logger.warn(
        {
          verdict: report.verdict,
          rounds,
          ops: applied.length,
          modelCalled: modelCalledRef.value,
          durationMs: report.durationMs,
          blocking: round.blocking.map((b) => b.code),
        },
        'report_v4.repair_summary'
      )
      return report
    }

    const proseAfter = countProseBlocks(current)
    if (proseBefore > 0 && (proseBefore - proseAfter) / proseBefore > dropRatioMax) {
      const report: RepairReport = {
        verdict: 'fallback',
        applied,
        remaining: [
          {
            code: 'prose_drop_ratio',
            message: `More than ${Math.round(dropRatioMax * 100)}% of prose blocks removed`,
          },
        ],
        html: current,
        rounds,
        modelCalled: modelCalledRef.value,
        durationMs: Date.now() - started,
      }
      logger.warn(
        { verdict: report.verdict, rounds, ops: applied.length, modelCalled: modelCalledRef.value, durationMs: report.durationMs },
        'report_v4.repair_summary'
      )
      return report
    }

    if (hasKpiWithoutFact(current)) {
      const report: RepairReport = {
        verdict: 'fallback',
        applied,
        remaining: [{ code: 'kpi_without_fact', message: 'KPI tile has literal number without data-fact' }],
        html: current,
        rounds,
        modelCalled: modelCalledRef.value,
        durationMs: Date.now() - started,
      }
      logger.warn(
        { verdict: report.verdict, rounds, ops: applied.length, modelCalled: modelCalledRef.value, durationMs: report.durationMs },
        'report_v4.repair_summary'
      )
      return report
    }

    remaining = await ctx.reaudit(current)
    remaining = [
      ...remaining,
      ...issuesFromMissingChartHosts(findMissingChartHosts(current, ctx.requiredChartIds)),
      ...issuesFromDuplicateChartHosts(findDuplicateChartHosts(current)),
    ]
    if (remaining.length === 0) break
    if (round.ops.length === 0) break
  }

  const missingAfter = findMissingChartHosts(current, ctx.requiredChartIds)
  if (ctx.requiredChartIds.length > 0 && missingAfter.length === ctx.requiredChartIds.length) {
    const report: RepairReport = {
      verdict: 'fallback',
      applied,
      remaining: [
        {
          code: 'chart_hosts_absent',
          message: 'No required chart-box present after repair',
          evidence: missingAfter.join(','),
        },
      ],
      html: current,
      rounds,
      modelCalled: modelCalledRef.value,
      durationMs: Date.now() - started,
    }
    logger.warn(
      { verdict: report.verdict, rounds, ops: applied.length, modelCalled: modelCalledRef.value, durationMs: report.durationMs },
      'report_v4.repair_summary'
    )
    return report
  }

  if (remaining.length > 0) {
    const report: RepairReport = {
      verdict: 'fallback',
      applied,
      remaining,
      html: current,
      rounds,
      modelCalled: modelCalledRef.value,
      durationMs: Date.now() - started,
    }
    logger.warn(
      {
        verdict: report.verdict,
        rounds,
        ops: applied.length,
        modelCalled: modelCalledRef.value,
        durationMs: report.durationMs,
        remaining: remaining.map((r) => r.code),
      },
      'report_v4.repair_summary'
    )
    return report
  }

  const report: RepairReport = {
    verdict: applied.length > 0 ? 'repaired' : 'ok',
    applied,
    remaining: [],
    html: current,
    rounds,
    modelCalled: modelCalledRef.value,
    durationMs: Date.now() - started,
  }
  logger.info(
    {
      verdict: report.verdict,
      rounds,
      ops: applied.length,
      modelCalled: modelCalledRef.value,
      durationMs: report.durationMs,
    },
    'report_v4.repair_summary'
  )
  return report
}
