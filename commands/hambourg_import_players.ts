import { TestHambourgService } from '#services/test_hambourg_service'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class HambourgImportPlayers extends BaseCommand {
  static commandName = 'hambourg:import-players'
  static description = 'Import Hamburg players from hambourg/player-list.csv'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { created, skipped, warnings } = await new TestHambourgService().importPlayers()

    this.logger.success(`Created ${created} athletes, skipped ${skipped}`)

    for (const warning of warnings) {
      this.logger.warning(warning)
    }
  }
}
