import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ExternalApiKeyService from '#services/external_api_key_service'

export default class ExternalCreateApiKey extends BaseCommand {
  static commandName = 'external:create-api-key'
  static description = 'Create a club API key for the external Mauna API'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Club id' })
  declare clubId: string

  @flags.string({ description: 'Label for this key' })
  declare name: string

  async run() {
    if (!this.clubId || !this.name) {
      this.logger.error('Missing --clubId and --name')
      this.exitCode = 1
      return
    }

    const { apiKey, plaintext } = await new ExternalApiKeyService().create({
      clubId: this.clubId,
      name: this.name,
    })

    this.logger.success(`Created API key ${apiKey.id} (${apiKey.keyPrefix}...)`)
    this.logger.warning('Store this key now. It will not be shown again.')
    this.logger.info(plaintext)
  }
}
