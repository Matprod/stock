import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import {
  buildDataProfileCanvasText,
  type HarvestDataProfile,
} from '#services/report_v4/data_profiler'
import type { AppLanguage } from '#utils/localize'

export type DataReliabilityReport = {
  title: string
  body: string
  sampleRows: number
  datasetCount: number
  partialDomains: string[]
  emptyDomains: string[]
  unusableDomains: string[]
  coverageNote?: string
}

export const buildDataReliabilityReport = (
  profile: HarvestDataProfile,
  language: AppLanguage
): DataReliabilityReport => {
  const canvas = buildDataProfileCanvasText(profile, language)
  const sampleRows = profile.datasets.reduce((sum, row) => sum + row.rowCount, 0)
  const partialDomains = profile.domains
    .filter((row) => row.verdict === 'partial')
    .map((row) => String(row.domain))
  const window = profile.window
  const dated = profile.datasets.filter((row) => row.dateMin && row.dateMax)
  let coverageNote: string | undefined
  if (window && dated.length) {
    const early = dated.filter((row) => row.dateMin && row.dateMin > window.from)
    const late = dated.filter((row) => row.dateMax && row.dateMax < window.to)
    if (early.length || late.length) {
      coverageNote =
        language === 'fr'
          ? `Fenêtre demandée ${window.from}→${window.to} ; ${early.length} jeu(x) démarrent après le début, ${late.length} s'arrêtent avant la fin.`
          : `Requested window ${window.from}→${window.to}; ${early.length} dataset(s) start after from, ${late.length} end before to.`
    }
  }

  const sampleLine =
    language === 'fr'
      ? `Échantillon : ${sampleRows} ligne(s) sur ${profile.datasets.length} jeu(x).`
      : `Sample: ${sampleRows} row(s) across ${profile.datasets.length} dataset(s).`

  const bodyParts = [sampleLine, coverageNote, canvas.body].filter(Boolean)
  return {
    title: language === 'fr' ? 'Fiabilité des données' : 'Data reliability',
    body: bodyParts.join(' '),
    sampleRows,
    datasetCount: profile.datasets.length,
    partialDomains,
    emptyDomains: profile.emptyDomains.map(String),
    unusableDomains: profile.unusableDomains.map(String),
    coverageNote,
  }
}

const RELIABILITY_TITLE_RE = /fiabilit[eé] des donn[eé]es|data reliability|ce que les donn[eé]es permettent|what the data allows/i

export const ensureDataReliabilityBlocks = (
  document: PremiumReportDocument,
  profile: HarvestDataProfile,
  language: AppLanguage
): { document: PremiumReportDocument; inserted: boolean } => {
  const already = document.blocks.some(
    (block) =>
      (block.type === 'heading' || block.type === 'text') &&
      RELIABILITY_TITLE_RE.test('text' in block ? block.text : '')
  )
  if (already) return { document, inserted: false }

  const report = buildDataReliabilityReport(profile, language)
  const headingId = `reliability-h-${document.blocks.length + 1}`
  const textId = `reliability-t-${document.blocks.length + 2}`
  return {
    inserted: true,
    document: {
      ...document,
      blocks: [
        ...document.blocks,
        {
          id: headingId,
          type: PREMIUM_BLOCK_TYPE.HEADING,
          text: report.title,
          level: 2,
        },
        {
          id: textId,
          type: PREMIUM_BLOCK_TYPE.TEXT,
          text: report.body,
        },
      ],
    },
  }
}
