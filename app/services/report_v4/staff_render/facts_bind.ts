import { formatStaffNumber } from '#services/report_v4/staff_render/format'

export type StaffFact = {
  id: string
  value: number
  digits?: number
}

const FACT_TOKEN_RE = /\{\{fait:([a-z][a-z0-9]*(?:\.[a-z0-9_]+)+)\}\}/gi
const LITERAL_NUMBER_RE = /(?<![A-Za-z0-9_])(-?\d+(?:[.,]\d+)?)(?![A-Za-z0-9_])/g

export const bindStaffFactTokens = (
  text: string,
  facts: Map<string, StaffFact> | Iterable<StaffFact>
): { text: string; missing: string[]; replaced: number } => {
  const byId =
    facts instanceof Map ? facts : new Map([...facts].map((fact) => [fact.id, fact]))
  const missing: string[] = []
  let replaced = 0
  const out = text.replace(FACT_TOKEN_RE, (_full, id: string) => {
    const fact = byId.get(id)
    if (!fact) {
      missing.push(id)
      return _full
    }
    replaced += 1
    return formatStaffNumber(fact.value, {
      maximumFractionDigits: fact.digits ?? (Number.isInteger(fact.value) ? 0 : 1),
    })
  })
  return { text: out, missing: [...new Set(missing)], replaced }
}

export const bindFactsInUnknown = (
  value: unknown,
  facts: Map<string, StaffFact>
): { value: unknown; missing: string[]; warnings: string[] } => {
  const missing: string[] = []
  const warnings: string[] = []
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      const bound = bindStaffFactTokens(node, facts)
      missing.push(...bound.missing)
      if (facts.size > 0) {
        const stripped = bound.text.replace(FACT_TOKEN_RE, ' ')
        for (const match of stripped.matchAll(LITERAL_NUMBER_RE)) {
          warnings.push(`literal_number:${match[1]}`)
        }
      }
      return bound.text
    }
    if (Array.isArray(node)) return node.map((row) => walk(row))
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        out[key] = walk(child)
      }
      return out
    }
    return node
  }
  return { value: walk(value), missing: [...new Set(missing)], warnings: [...new Set(warnings)] }
}
