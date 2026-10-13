import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ExternalApiKeyService from '#services/external_api_key_service'

export default class ExternalRevokeApiKey extends BaseCommand {
  static commandName = 'external:revoke-api-key'
  static description = 'Revoke an external API key'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'API key id' })
  declare id: string

  async run() {
    if (!this.id) {
      this.logger.error('Missing --id')
      this.exitCode = 1
      return
    }

    const apiKey = await new ExternalApiKeyService().revoke(this.id)
    this.logger.success(`Revoked API key ${apiKey.id} (${apiKey.keyPrefix}...)`)
  }
}
