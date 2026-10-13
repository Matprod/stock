import Prompt from '#models_pg/prompt'
import { PREMIUM_REPORT_PROMPT_TITLE } from '#constants/premium_report.constants'
import { PREMIUM_REPORT_PROMPT_DEFAULT } from '#constants/premium_report_prompt'

export const loadPremiumReportPrompt = async (clubId: string): Promise<string> => {
  const clubRow = await Prompt.query()
    .where('title', PREMIUM_REPORT_PROMPT_TITLE)
    .where('clubId', clubId)
    .first()
  if (clubRow?.content.trim()) return clubRow.content

  const globalRow = await Prompt.query()
    .where('title', PREMIUM_REPORT_PROMPT_TITLE)
    .whereNull('clubId')
    .first()
  if (globalRow?.content.trim()) return globalRow.content

  return PREMIUM_REPORT_PROMPT_DEFAULT
}
