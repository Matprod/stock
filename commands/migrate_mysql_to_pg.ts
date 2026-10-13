import { AVAILABLE_TABLES, resolveMigrators } from '#services/migration/registry'
import { setMigrationBatchSizeOverride } from '#services/migration/migrate_table'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class MigrateMysqlToPg extends BaseCommand {
  static commandName = 'supermegamigration'
  static description = 'Migrate data from MySQL to PostgreSQL'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Dry run — no writes' })
  declare dryRun: boolean

  @flags.boolean({ description: 'Apply writes to PostgreSQL (required to run for real)' })
  declare force: boolean

  @flags.string({ description: 'Migrate only one table (e.g. sports, athletes)' })
  declare onlyTable: string

  @flags.number({
    description: 'Override batch size for all tables (default: per-table, up to 2000)',
  })
  declare batchSize: number

  async run() {
    if (!this.dryRun && !this.force) {
      this.logger.error('Refusing to write. Use --dry-run to simulate, or --force to apply.')
      this.exitCode = 1
      return
    }

    const mysql = db.connection('mysql')
    const pg = db.connection('pg')

    const migrators = resolveMigrators(this.onlyTable)

    if (this.onlyTable && migrators.length === 0) {
      this.logger.error(`Unknown table: ${this.onlyTable}`)
      this.logger.info(`Available: ${AVAILABLE_TABLES.join(', ')}`)
      this.exitCode = 1
      return
    }

    if (this.dryRun) {
      this.logger.info('Dry run — no writes')
    }

    if (this.batchSize !== undefined) {
      if (this.batchSize < 1 || this.batchSize > 10_000) {
        this.logger.error('batch-size must be between 1 and 10000')
        this.exitCode = 1
        return
      }
      setMigrationBatchSizeOverride(this.batchSize)
      this.logger.info(`Batch size override: ${this.batchSize}`)
    }

    if (!this.dryRun) {
      await pg.raw('SET session_replication_role = replica')
    }

    try {
      for (const { name, migrate } of migrators) {
        this.logger.info(`Migrating ${name}...`)
        const result = await migrate(mysql, pg, !!this.dryRun)
        const verb = this.dryRun ? 'would insert' : 'inserted'
        this.logger.success(
          `✅ ${result.table}: ${result.inserted} ${verb}, ${result.skipped} skipped, ${result.rejected} rejected (${result.total} in MySQL)`
        )
      }
    } finally {
      setMigrationBatchSizeOverride(undefined)
      if (!this.dryRun) {
        await pg.raw('SET session_replication_role = DEFAULT')
      }
    }
  }
}
