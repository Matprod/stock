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

export type SoftDiffGateResult = {
  ok: boolean
  mutatedOutsideAllowlist: string[]
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
    if (hashPremiumBlock(prior) !== hashPremiumBlock(block)) {
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
  return {
    ok: mutatedOutsideAllowlist.length === 0,
    mutatedOutsideAllowlist,
    unchangedOutside,
    checkedOutside,
  }
}
