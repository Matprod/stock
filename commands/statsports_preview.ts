import { CLUB_PROVIDER_TYPES } from '#constants/club_provider.constants'
import ClubProvider from '#models_pg/club_provider'
import { StatssportsService } from '#services/statsports_service'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'

export default class StatssportsPreview extends BaseCommand {
  static commandName = 'statsports:preview'
  static description = 'Fetch STATSports drill rows for a club provider'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Club id (omit to fetch all configured STATSports clubs)' })
  declare clubId: string | undefined

  @flags.string({ description: 'Session start ISO datetime' })
  declare from: string | undefined

  @flags.string({ description: 'Session end ISO datetime' })
  declare to: string | undefined

  @flags.number({ description: 'Chunk size in days', default: 7 })
  declare chunkDays: number

  @flags.number({ description: 'Max rows to keep (0 = all)', default: 0 })
  declare limit: number

  @flags.number({ description: 'Number of rows to print', default: 3 })
  declare preview: number

  async run() {
    const to = this.to ? DateTime.fromISO(this.to, { zone: 'utc' }) : DateTime.utc()
    const from = this.from
      ? DateTime.fromISO(this.from, { zone: 'utc' })
      : to.minus({ days: 7 }).startOf('day')
    if (!from.isValid || !to.isValid) {
      throw new Error('Invalid --from/--to ISO datetime')
    }
    if (to < from) {
      throw new Error('--to must be >= --from')
    }

    const sessionStart = from.toUTC().toISO()
    const sessionEnd = to.toUTC().toISO()
    if (!sessionStart || !sessionEnd) {
      throw new Error('Invalid --from/--to ISO datetime')
    }
    const maxRows = this.limit > 0 ? this.limit : undefined
    const providers = await this.resolveProviders()

    if (providers.length === 0) {
      this.logger.error('No STATSports club provider configured (accessToken required)')
      this.exitCode = 1
      return
    }

    this.logger.info(`from=${sessionStart} to=${sessionEnd} chunkDays=${this.chunkDays}`)

    for (const provider of providers) {
      const service = StatssportsService.fromClubProvider(provider)
      const result = await service.fetchMappedRows({
        sessionStart,
        sessionEnd,
        chunkDays: this.chunkDays,
        maxRows,
      })

      this.logger.info(
        `club=${result.clubId} chunks=${result.chunks} sessions=${result.bundles} rows=${result.rows.length}`
      )

      for (const [index, row] of result.rows.slice(0, this.preview).entries()) {
        const metricPreview = Object.fromEntries(
          Object.entries(row)
            .filter(([key, value]) => key.startsWith('kpi_') && value !== null)
            .slice(0, 8)
        )

        this.logger.info(`preview ${index + 1}`)
        this.logger.info(
          JSON.stringify({
            player: `${row.player_firstName ?? ''} ${row.player_lastName ?? ''}`.trim(),
            session_date: row.session_date,
            session_type: row.session_type,
            drill_name: row.drill_name,
            metrics: metricPreview,
          })
        )
      }
    }
  }

  private async resolveProviders(): Promise<ClubProvider[]> {
    if (!this.clubId) {
      return StatssportsService.getConfiguredProviders()
    }

    const provider = await ClubProvider.query()
      .where('clubId', this.clubId)
      .where('provider', CLUB_PROVIDER_TYPES.STATSPORTS)
      .first()

    if (!provider?.accessToken) {
      throw new Error(`No STATSports club provider with accessToken for club ${this.clubId}`)
    }

    return [provider]
  }
}
