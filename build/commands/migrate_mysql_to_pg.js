var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { AVAILABLE_TABLES, resolveMigrators } from '#services/migration/registry';
import { setMigrationBatchSizeOverride } from '#services/migration/migrate_table';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
export default class MigrateMysqlToPg extends BaseCommand {
    static commandName = 'supermegamigration';
    static description = 'Migrate data from MySQL to PostgreSQL';
    static options = {
        startApp: true,
    };
    async run() {
        if (!this.dryRun && !this.force) {
            this.logger.error('Refusing to write. Use --dry-run to simulate, or --force to apply.');
            this.exitCode = 1;
            return;
        }
        const mysql = db.connection('mysql');
        const pg = db.connection('pg');
        const migrators = resolveMigrators(this.onlyTable);
        if (this.onlyTable && migrators.length === 0) {
            this.logger.error(`Unknown table: ${this.onlyTable}`);
            this.logger.info(`Available: ${AVAILABLE_TABLES.join(', ')}`);
            this.exitCode = 1;
            return;
        }
        if (this.dryRun) {
            this.logger.info('Dry run — no writes');
        }
        if (this.batchSize !== undefined) {
            if (this.batchSize < 1 || this.batchSize > 10_000) {
                this.logger.error('batch-size must be between 1 and 10000');
                this.exitCode = 1;
                return;
            }
            setMigrationBatchSizeOverride(this.batchSize);
            this.logger.info(`Batch size override: ${this.batchSize}`);
        }
        if (!this.dryRun) {
            await pg.raw('SET session_replication_role = replica');
        }
        try {
            for (const { name, migrate } of migrators) {
                this.logger.info(`Migrating ${name}...`);
                const result = await migrate(mysql, pg, !!this.dryRun);
                const verb = this.dryRun ? 'would insert' : 'inserted';
                this.logger.success(`✅ ${result.table}: ${result.inserted} ${verb}, ${result.skipped} skipped, ${result.rejected} rejected (${result.total} in MySQL)`);
            }
        }
        finally {
            setMigrationBatchSizeOverride(undefined);
            if (!this.dryRun) {
                await pg.raw('SET session_replication_role = DEFAULT');
            }
        }
    }
}
__decorate([
    flags.boolean({ description: 'Dry run — no writes' }),
    __metadata("design:type", Boolean)
], MigrateMysqlToPg.prototype, "dryRun", void 0);
__decorate([
    flags.boolean({ description: 'Apply writes to PostgreSQL (required to run for real)' }),
    __metadata("design:type", Boolean)
], MigrateMysqlToPg.prototype, "force", void 0);
__decorate([
    flags.string({ description: 'Migrate only one table (e.g. sports, athletes)' }),
    __metadata("design:type", String)
], MigrateMysqlToPg.prototype, "onlyTable", void 0);
__decorate([
    flags.number({
        description: 'Override batch size for all tables (default: per-table, up to 2000)',
    }),
    __metadata("design:type", Number)
], MigrateMysqlToPg.prototype, "batchSize", void 0);
//# sourceMappingURL=migrate_mysql_to_pg.js.map