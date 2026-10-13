import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class HambourgCleanupOrphanActivities extends BaseCommand {
  static commandName = 'hambourg:cleanup-orphan-activities'
  static description = 'Delete statsports activities with null day_id (calendar crash)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Club id',
    default: HAMBOURG_CLUB_ID,
  })
  declare clubId: string

  @flags.boolean({
    description: 'Actually delete the orphan activities',
    default: false,
  })
  declare apply: boolean

  async run() {
    const clubId = this.clubId || HAMBOURG_CLUB_ID
    const dryRun = !this.apply

    const { rows } = await db.rawQuery(
      `
      SELECT sa.id
      FROM sport_activities sa
      LEFT JOIN events e ON e.id = sa.event_id
      WHERE sa.day_id IS NULL
        AND sa.data_source = 'statsports'
        AND (e.club_id = ? OR sa.event_id IS NULL)
      `,
      [clubId]
    )

    const ids = rows.map((row: { id: string }) => row.id)
    this.logger.info(
      `orphan statsports activities club=${clubId} count=${ids.length} mode=${dryRun ? 'dry-run' : 'APPLY'}`
    )

    if (dryRun || ids.length === 0) return

    await db.from('sport_activities').whereIn('id', ids).delete()
    this.logger.info(`deleted ${ids.length} orphan activities`)
  }
}
