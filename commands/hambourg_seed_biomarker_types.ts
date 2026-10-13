import { DIAGNOSTIK_BIOMARKER_DEFS } from '#constants/diagnostik.constants'
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import BiomarkerType from '#models_pg/biomarker_type'
import db from '@adonisjs/lucid/services/db'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class HambourgSeedBiomarkerTypes extends BaseCommand {
  static commandName = 'hambourg:seed-biomarker-types'
  static description = 'Create biomarker_types for Hamburg diagnostik.xlsx columns'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'List types without writing to DB' })
  declare dryRun: boolean

  async run() {
    const entries = Object.values(DIAGNOSTIK_BIOMARKER_DEFS)
    this.logger.info(`${entries.length} diagnostik biomarker types to seed`)

    let created = 0
    let updated = 0
    let unchanged = 0
    let linked = 0

    for (const def of entries) {
      if (this.dryRun) {
        this.logger.info(`  ${def.name} (${def.unit})`)
        continue
      }

      let type = await BiomarkerType.findBy('name', def.name)

      if (!type) {
        type = await BiomarkerType.create({ name: def.name, unit: def.unit })
        created++
      } else if (type.unit !== def.unit) {
        type.unit = def.unit
        await type.save()
        updated++
      } else {
        unchanged++
      }

      const existingLink = await db
        .from('biomarker_type_clubs')
        .where('biomarker_type_id', type.id)
        .where('club_id', HAMBOURG_CLUB_ID)
        .first()

      if (!existingLink) {
        await type.related('clubs').attach([HAMBOURG_CLUB_ID])
        linked++
      }
    }

    if (this.dryRun) {
      this.logger.info(`Dry run: would seed ${entries.length} diagnostik biomarker types`)
      return
    }

    this.logger.success(
      `Done: ${created} created, ${updated} updated, ${unchanged} unchanged, ${linked} club links`
    )
  }
}
