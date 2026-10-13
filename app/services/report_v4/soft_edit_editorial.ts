import type { PremiumReportDocument } from '#contracts/premium_report'
import {
  assertSoftEditorialGates,
  buildChartOptionHostMap,
  dropCanvasBlocksByTitleQuery,
  ensureTocInHtml,
  removeSectionsByQuery,
  stripEmptyChartSections,
  syncCanvasAfterSectionRemoval,
  type ArtifactSection,
} from '#services/report_v4/artifact_sections'
import type { AppLanguage } from '#utils/localize'

export type SoftEditorialResult = {
  html: string
  document: PremiumReportDocument
  removed: ArtifactSection[]
  tocAdded: boolean
  emptyStripped: number
  droppedBlockIds: string[]
  gates: { ok: boolean; errors: string[] }
}

export const applySoftEditorialToHtml = (args: {
  html: string
  document: PremiumReportDocument
  removeQueries: string[]
  ensureToc: boolean
  stripEmpty: boolean
  language: AppLanguage
  clubName?: string
  reportTitle?: string
}): SoftEditorialResult => {
  let html = args.html
  let document = args.document
  const removed: ArtifactSection[] = []
  let emptyStripped = 0
  const removedCountByQuery: Record<string, number> = {}
  const droppedBlockIds: string[] = []

  for (const query of args.removeQueries) {
    const result = removeSectionsByQuery(html, query)
    html = result.html
    removed.push(...result.removed)
    removedCountByQuery[query] = (removedCountByQuery[query] ?? 0) + result.removed.length
    if (result.removed.length === 0) {
      const dropped = dropCanvasBlocksByTitleQuery(document, query)
      document = dropped.document
      droppedBlockIds.push(...dropped.droppedBlockIds)
      if (dropped.droppedBlockIds.length > 0) {
        removedCountByQuery[query] = (removedCountByQuery[query] ?? 0) + 1
      }
    }
  }

  if (args.stripEmpty) {
    const emptied = stripEmptyChartSections(html, buildChartOptionHostMap(document))
    html = emptied.html
    emptyStripped = emptied.removed.length
    removed.push(...emptied.removed)
  }

  const synced = syncCanvasAfterSectionRemoval(document, removed)
  document = synced.document
  droppedBlockIds.push(...synced.droppedBlockIds)

  let tocAdded = false
  if (args.ensureToc) {
    const toc = ensureTocInHtml(html, {
      language: args.language,
      clubName: args.clubName,
      reportTitle: args.reportTitle,
    })
    html = toc.html
    tocAdded = toc.added
  }

  const gates = assertSoftEditorialGates({
    html,
    removeQueries: args.removeQueries,
    ensureToc: args.ensureToc,
    removedCountByQuery,
  })

  return {
    html,
    document,
    removed,
    tocAdded,
    emptyStripped,
    droppedBlockIds: [...new Set(droppedBlockIds)],
    gates,
  }
}
