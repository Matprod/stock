import { INSIGHT_CATEGORIES, type PredictionType } from '#constants/insight.constants'
import { isChatbotMlClub } from '#constants/chatbot.constants'
import ChatbotReportService from '#services/chatbot_report_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class ChatbotRegenerateReports extends BaseCommand {
  static commandName = 'chatbot:regenerate-reports'
  static description =
    'Regenerate chatbot daily reports for a club date range (threshold filter only)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Club UUID (ML club)', required: true })
  declare clubId: string

  @flags.string({ description: 'From ISO date YYYY-MM-DD (inclusive)', required: true })
  declare from: string

  @flags.string({ description: 'To ISO date YYYY-MM-DD (inclusive)', required: true })
  declare to: string

  @flags.array({
    name: 'athleteId',
    description: 'Limit to athlete UUID(s) (repeatable)',
  })
  declare athleteId: string[]

  @flags.string({
    description: `Category filter (${INSIGHT_CATEGORIES.join(' | ')}). Default: both`,
  })
  declare category: string | undefined

  @flags.boolean({ description: 'List eligible day/category pairs without calling the LLM' })
  declare dryRun: boolean

  async run() {
    if (!isChatbotMlClub(this.clubId)) {
      this.logger.error('clubId must be an ML chatbot club (Sunderland / Hamburg)')
      this.exitCode = 1
      return
    }

    let categories: PredictionType[] | undefined
    if (this.category) {
      if (!(INSIGHT_CATEGORIES as readonly string[]).includes(this.category)) {
        this.logger.error(`Invalid --category ${this.category}`)
        this.exitCode = 1
        return
      }
      categories = [this.category as PredictionType]
    }

    this.logger.info(
      `chatbot reports ${this.from} → ${this.to} club=${this.clubId}` +
        (this.athleteId?.length ? ` athletes=${this.athleteId.length}` : '') +
        (categories ? ` category=${categories[0]}` : '') +
        (this.dryRun ? ' dryRun' : '')
    )

    const service = new ChatbotReportService()
    const result = await service.regenerateForClubRange({
      clubId: this.clubId,
      from: this.from,
      to: this.to,
      athleteIds: this.athleteId?.length ? this.athleteId : undefined,
      categories,
      dryRun: this.dryRun === true,
    })

    this.logger.info(
      `athletes=${result.athletes} days=${result.days} eligible=${result.eligible} ` +
        `generated=${result.generated} failed=${result.failed} ` +
        `skippedNoScore=${result.skippedNoScore} skippedFilter=${result.skippedFilter}`
    )

    if (result.failed > 0) {
      this.exitCode = 1
      return
    }

    this.logger.success(
      this.dryRun
        ? `Dry run: ${result.eligible} day(s) would regenerate`
        : `Regenerated ${result.generated} report(s) across ${result.eligible} day(s)`
    )
  }
}
