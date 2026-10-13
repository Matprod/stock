import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Intent ids must match `## Intent: <id>` headings in response_structure.md */
export const RESPONSE_STRUCTURE_INTENTS = [
  'metric_deep_analysis',
  'strategic_evaluation',
  'conceptual_clarification',
  'hypothesis_claim_checking',
  'direct_data_question',
  'global_analysis',
  'contributing_variable_analysis',
  'general',
] as const

export type ResponseStructureIntent = (typeof RESPONSE_STRUCTURE_INTENTS)[number]

let intentSectionsCache: Map<string, string> | null = null

function loadIntentSections(): Map<string, string> {
  if (intentSectionsCache) return intentSectionsCache

  const mdPath = join(__dirname, 'response_structure.md')
  const md = readFileSync(mdPath, 'utf-8')
  const map = new Map<string, string>()

  for (const part of md.split(/\n(?=## Intent:)/)) {
    const match = part.match(/^## Intent:\s*(\S+)/)
    if (!match) continue
    const id = match[1].trim()
    map.set(id, part.trim())
  }

  intentSectionsCache = map
  return map
}

/**
 * Returns the markdown module for this intent, or null if unknown.
 */
export function getResponseStructure(intent: string): string | null {
  const map = loadIntentSections()
  return map.get(intent.trim()) ?? null
}
