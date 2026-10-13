import { foldAscii } from '#utils/html_text'

const WHOLE_MONTH =
  /\b(?:whole|entire|full)\s+(?:the\s+)?month\b|\ball\s+of\s+(?:the\s+)?month\b/

const isoDate = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const lastDayOfMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate()

type MonthHit = { month: number; year: number; index: number }

const isoMonthHit = (text: string): MonthHit | undefined => {
  const hits: MonthHit[] = []
  for (const match of text.matchAll(/\b(20\d{2})-(\d{2})(?:-\d{2})?\b/g)) {
    const year = Number(match[1])
    const month = Number(match[2])
    if (month >= 1 && month <= 12 && Number.isFinite(year)) {
      hits.push({ month, year, index: match.index ?? 0 })
    }
  }
  if (hits.length === 0) return undefined
  const months = new Set(hits.map((hit) => hit.month))
  if (months.size > 1) return undefined
  return hits.sort((left, right) => left.index - right.index)[0]
}

export const resolvePromptDateRange = (
  prompt: string,
  selected: { from: string; to: string }
): { from: string; to: string } => {
  const text = foldAscii(prompt)
  const named = isoMonthHit(text)
  if (!named && !WHOLE_MONTH.test(text)) return selected

  const month = named?.month ?? Number(selected.from.slice(5, 7))
  const year = named?.year ?? Number(selected.from.slice(0, 4))
  if (!month || month < 1 || month > 12 || !Number.isFinite(year)) return selected

  return {
    from: isoDate(year, month, 1),
    to: isoDate(year, month, lastDayOfMonth(year, month)),
  }
}
