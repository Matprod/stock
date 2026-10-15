import logger from '@adonisjs/core/services/logger'
import type { PremiumReportDocument } from '#contracts/premium_report'
import type { StaffHeatScale } from '#services/premium_report/premium_report_document'
import { collectArtifactCharts } from '#services/report_v4/artifact_html'
import { applyResolvedSoftEditorial, type SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import type { AppLanguage } from '#utils/localize'

export const applySoftEditorialPhase = (args: {
  reboundHtml: string
  document: PremiumReportDocument
  softOps: SoftEditOpsPlan | null
  softEditorialAppliedEarly: boolean
  language: AppLanguage
  clubName: string
  heatScales: StaffHeatScale[]
}): {
  reboundHtml: string
  document: PremiumReportDocument
  chartCount: number
  editorialRemoved: number
  tocAdded: boolean
  emptyStripped: number
  editorialGatesOk: boolean
} => {
  let reboundHtml = args.reboundHtml
  let document = args.document
  let editorialRemoved = 0
  let tocAdded = false
  let emptyStripped = 0
  let editorialGatesOk = true
  let chartCount = collectArtifactCharts(document, args.heatScales).length

  const shouldApply =
    args.softOps &&
    ((args.softOps.removeQueries.length > 0 && !args.softEditorialAppliedEarly) ||
      args.softOps.ensureToc ||
      args.softOps.ops.some((op) => op.type === 'strip_empty_sections'))

  if (shouldApply && args.softOps) {
    const lateOps = args.softEditorialAppliedEarly
      ? {
          ...args.softOps,
          removeQueries: [] as string[],
          ops: args.softOps.ops.filter((op) => op.type !== 'remove_section'),
        }
      : args.softOps
    const editorial = applyResolvedSoftEditorial({
      html: reboundHtml,
      document,
      ops: lateOps,
      language: args.language,
      clubName: args.clubName,
      reportTitle: document.title,
    })
    reboundHtml = editorial.html
    document = editorial.document
    editorialRemoved = editorial.removed.length
    tocAdded = editorial.tocAdded
    emptyStripped = editorial.emptyStripped
    editorialGatesOk = editorial.gates.ok
    chartCount = collectArtifactCharts(document, args.heatScales).length
    logger.info(
      {
        removedSections: editorialRemoved,
        tocAdded,
        emptyStripped,
        droppedBlockIds: editorial.droppedBlockIds,
        gates: editorial.gates,
        earlyRemove: args.softEditorialAppliedEarly,
      },
      'report_v4.soft_editorial_applied'
    )
    if (!editorial.gates.ok) {
      logger.warn({ errors: editorial.gates.errors }, 'report_v4.soft_editorial_gates_failed')
    }
  } else if (args.softEditorialAppliedEarly) {
    editorialGatesOk = true
  }

  return {
    reboundHtml,
    document,
    chartCount,
    editorialRemoved,
    tocAdded,
    emptyStripped,
    editorialGatesOk,
  }
}
