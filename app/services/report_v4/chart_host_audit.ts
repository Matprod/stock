import { parseHTML } from 'linkedom'

const wrapHtml = (html: string): string =>
  /<html[\s>]/i.test(html) ? html : `<!DOCTYPE html><html><body>${html}</body></html>`

const listChartHostIds = (html: string): string[] => {
  const { document } = parseHTML(wrapHtml(html))
  return Array.from(document.querySelectorAll('.chart-box[id], div.chart-box[id]'))
    .map((el) => el.getAttribute('id') ?? '')
    .filter(Boolean)
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
