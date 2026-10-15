import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN, type PremiumDomain } from '#constants/premium_report_domains'
import type { PremiumReportDocument } from '#contracts/premium_report'

const MATCH_NOTICE = 'No match data for the selected period.'
const MATCH_NOTICE_RE = /no match data for the (selected )?period/i

export const ensureMissingDomainNotices = (args: {
  document: PremiumReportDocument
  domains: PremiumDomain[]
  emptyDomains: Array<string | PremiumDomain>
}): { document: PremiumReportDocument; inserted: string[] } => {
  const empty = new Set(args.emptyDomains.map((row) => String(row)))
  const inserted: string[] = []
  let blocks = [...args.document.blocks]

  if (
    args.domains.includes(PREMIUM_DOMAIN.MATCH) &&
    empty.has(PREMIUM_DOMAIN.MATCH) &&
    !blocks.some(
      (block) =>
        (block.type === PREMIUM_BLOCK_TYPE.TEXT || block.type === PREMIUM_BLOCK_TYPE.HEADING) &&
        MATCH_NOTICE_RE.test('text' in block ? block.text : '')
    )
  ) {
    blocks = [
      ...blocks,
      {
        id: `missing-match-${blocks.length + 1}`,
        type: PREMIUM_BLOCK_TYPE.TEXT,
        text: MATCH_NOTICE,
      },
    ]
    inserted.push(PREMIUM_DOMAIN.MATCH)
  }

  if (inserted.length === 0) return { document: args.document, inserted }
  return { document: { ...args.document, blocks }, inserted }
}
