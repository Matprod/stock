import { createHash } from 'node:crypto'
import type { PremiumReportDocument } from '#contracts/premium_report'

const stableStringify = (value: unknown): string => {
  if (value == null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((row) => stableStringify(row)).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

export const hashPremiumBlock = (block: PremiumReportDocument['blocks'][number]): string =>
  createHash('sha1').update(stableStringify(block)).digest('hex').slice(0, 16)

const identityFingerprint = (block: PremiumReportDocument['blocks'][number]): string => {
  if (block.type === 'heading' || block.type === 'text') {
    return stableStringify({ id: block.id, type: block.type, text: block.text.trim() })
  }
  if (block.type === 'chart') {
    return stableStringify({ id: block.id, type: block.type, title: block.title.trim() })
  }
  return stableStringify({
    id: block.id,
    type: block.type,
    title: block.title?.trim() ?? '',
    columns: block.columns,
    rowCount: block.rows.length,
  })
}

export type SoftDiffGateResult = {
  ok: boolean
  mutatedOutsideAllowlist: string[]
  orderChanged: boolean
  documentFieldsChanged: string[]
  unchangedOutside: number
  checkedOutside: number
}

export const evaluateSoftDiffGate = (args: {
  prior: PremiumReportDocument
  next: PremiumReportDocument
  allowBlockIds: Set<string> | null | undefined
}): SoftDiffGateResult | null => {
  if (!args.allowBlockIds) return null
  const priorById = new Map(args.prior.blocks.map((block) => [block.id, block]))
  const mutatedOutsideAllowlist: string[] = []
  let unchangedOutside = 0
  let checkedOutside = 0
  for (const block of args.next.blocks) {
    if (args.allowBlockIds.has(block.id)) continue
    const prior = priorById.get(block.id)
    if (!prior) {
      mutatedOutsideAllowlist.push(block.id)
      continue
    }
    checkedOutside += 1
    if (identityFingerprint(prior) !== identityFingerprint(block)) {
      mutatedOutsideAllowlist.push(block.id)
    } else {
      unchangedOutside += 1
    }
  }
  for (const block of args.prior.blocks) {
    if (args.allowBlockIds.has(block.id)) continue
    if (args.next.blocks.some((row) => row.id === block.id)) continue
    mutatedOutsideAllowlist.push(block.id)
  }

  const priorOutsideOrder = args.prior.blocks
    .filter((block) => !args.allowBlockIds!.has(block.id))
    .map((block) => block.id)
  const nextOutsideOrder = args.next.blocks
    .filter((block) => !args.allowBlockIds!.has(block.id))
    .map((block) => block.id)
  const orderChanged = priorOutsideOrder.join('\0') !== nextOutsideOrder.join('\0')

  const documentFieldsChanged: string[] = []
  if (args.prior.title.trim() !== args.next.title.trim()) documentFieldsChanged.push('title')
  if (
    args.prior.dateRange.from !== args.next.dateRange.from ||
    args.prior.dateRange.to !== args.next.dateRange.to
  ) {
    documentFieldsChanged.push('dateRange')
  }
  const priorAthletes = [...(args.prior.athleteIds ?? [])].sort().join(',')
  const nextAthletes = [...(args.next.athleteIds ?? [])].sort().join(',')
  if (priorAthletes !== nextAthletes) documentFieldsChanged.push('athleteIds')

  const allowDocFields = args.allowBlockIds.has('__document__')
  const docOk = allowDocFields || documentFieldsChanged.length === 0

  return {
    ok: mutatedOutsideAllowlist.length === 0 && !orderChanged && docOk,
    mutatedOutsideAllowlist,
    orderChanged,
    documentFieldsChanged,
    unchangedOutside,
    checkedOutside,
  }
}
