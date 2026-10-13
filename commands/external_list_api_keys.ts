import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ExternalApiKeyService from '#services/external_api_key_service'

export default class ExternalListApiKeys extends BaseCommand {
  static commandName = 'external:list-api-keys'
  static description = 'List external API keys for a club'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Club id' })
  declare clubId: string

  async run() {
    if (!this.clubId) {
      this.logger.error('Missing --clubId')
      this.exitCode = 1
      return
    }

    const keys = await new ExternalApiKeyService().listByClub(this.clubId)
    if (keys.length === 0) {
      this.logger.info('No API keys for this club')
      return
    }

    const table = this.ui.table()
    table.head(['ID', 'Name', 'Prefix', 'Last used', 'Revoked'])

    for (const key of keys) {
      table.row([
        key.id,
        key.name,
        key.keyPrefix,
        key.lastUsedAt?.toISO() ?? '-',
        key.revokedAt?.toISO() ?? '-',
      ])
    }

    table.render()
  }
}
