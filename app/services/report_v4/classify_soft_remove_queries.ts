import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import { noul, type TypeSafeClient } from '#services/jev_service'
import { invokeHaikuJson } from '#services/report_v4/haiku_json'
import { runIntentClassifier, type IntentProvider } from '#services/report_v4/jev_guard'
import { normalizeSoftTitleQuery } from '#services/report_v4/artifact_sections'
import type { SoftCanvasInventory } from '#services/report_v4/soft_canvas_inventory'
import { noulScore } from '#utils/jev_answers'
import type { AppLanguage } from '#utils/localize'
import { foldAscii } from '#utils/html_text'

const NOUL_TRUE = 0.55

const allowedTitles = (inventory?: SoftCanvasInventory | null): string[] => {
  if (!inventory) return []
  const titles = [
    ...inventory.sectionTitles,
    ...inventory.headings,
    ...inventory.charts.map((c) => c.title),
    ...inventory.tables.map((t) => t.title),
  ]
  return [...new Set(titles.map((t) => t.trim()).filter((t) => t.length >= 3))].slice(0, 40)
}

const canonicalizeQueries = (raw: string[], allowed: string[]): string[] => {
  if (raw.length === 0) return []
  if (allowed.length === 0) {
    return [...new Set(raw.map((q) => normalizeSoftTitleQuery(q) || q.trim()).filter((q) => q.length >= 3))]
  }
  const foldedAllowed = allowed.map((title) => ({
    title,
    fold: foldAscii(title),
  }))
  const out: string[] = []
  for (const query of raw) {
    const needle = foldAscii(normalizeSoftTitleQuery(query) || query)
    if (needle.length < 3) continue
    const hit =
      foldedAllowed.find((row) => row.fold === needle) ??
      foldedAllowed.find((row) => row.fold.includes(needle) || needle.includes(row.fold))
    if (hit) out.push(hit.title)
  }
  return [...new Set(out)]
}

const softRemoveQueriesFromHaikuJson = (
  raw: Record<string, unknown>,
  allowed: string[]
): string[] => {
  const list = Array.isArray(raw.remove_queries)
    ? raw.remove_queries.filter((q): q is string => typeof q === 'string')
    : []
  return canonicalizeQueries(list, allowed)
}

const classifyWithJev = async (
  client: TypeSafeClient,
  prompt: string,
  allowed: string[]
): Promise<string[]> => {
  if (allowed.length === 0) return []
  const questions = Object.fromEntries(
    allowed.map((title, index) => [
      `remove_${index}`,
      noul(`Should the coach remove the canvas block titled "${title}"?`, {
        true: `Remove "${title}"`,
        false: `Keep "${title}"`,
      }),
    ])
  )
  const response = await client.systemOne({
    model: JEV_ROUTER_MODEL,
    state: {
      prompt: prompt.slice(0, 3500),
      note: 'Pick only titles the coach asked to delete/remove from the existing report.',
      allowed_titles: allowed.join(' | '),
    },
    questions,
  })
  const answers = response.answers as Record<string, unknown>
  return allowed.filter((_, index) => noulScore(answers, `remove_${index}`) >= NOUL_TRUE)
}

const classifyWithHaiku = async (prompt: string, allowed: string[]): Promise<string[]> => {
  const raw = await invokeHaikuJson<Record<string, unknown>>({
    system: [
      'Select canvas titles to remove for a soft-edit ask.',
      'Respond ONLY with JSON: {"remove_queries":["Exact Title",...]}',
      'Titles MUST be copied exactly from the allowed list (or empty array).',
      `Allowed titles: ${allowed.length ? allowed.join(' | ') : '(none)'}`,
    ].join(' '),
    user: `Coach ask:\n${prompt.slice(0, 3500)}`,
  })
  return softRemoveQueriesFromHaikuJson(raw, allowed)
}

export const classifySoftRemoveQueries = async (args: {
  prompt: string
  inventory?: SoftCanvasInventory | null
  language?: AppLanguage
}): Promise<{ queries: string[]; provider: IntentProvider }> => {
  const allowed = allowedTitles(args.inventory)
  const { value, provider } = await runIntentClassifier({
    context: 'soft_remove_queries',
    language: args.language,
    jev: (client) => classifyWithJev(client, args.prompt, allowed),
    haiku: () => classifyWithHaiku(args.prompt, allowed),
  })
  
  return { queries: value, provider }
}
