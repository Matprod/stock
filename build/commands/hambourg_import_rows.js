var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { TestHambourgService } from '#services/test_hambourg_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
function formatErrorLine(error) {
    const parts = [`Row ${error.excelRow}`];
    if (error.player)
        parts.push(error.player);
    if (error.sessionDate)
        parts.push(error.sessionDate);
    if (error.drill)
        parts.push(`drill="${error.drill}"`);
    parts.push(error.message);
    return parts.join(' | ');
}
function groupErrorsByMessage(errors) {
    const groups = new Map();
    for (const error of errors) {
        const existing = groups.get(error.message) ?? [];
        existing.push(error);
        groups.set(error.message, existing);
    }
    return new Map([...groups.entries()].sort((a, b) => b[1].length - a[1].length));
}
export default class HambourgImportRows extends BaseCommand {
    static commandName = 'hambourg:import-rows';
    static description = 'Import Excel rows in batches with progress logs';
    static options = {
        startApp: true,
    };
    async run() {
        const totalBatches = Math.max(1, Math.ceil(this.limit / this.batchSize));
        console.log('');
        console.log(`Import STATSports — limit=${this.limit} offset=${this.offset} batch=${this.batchSize}`);
        console.log('Filter: Team = FBL, skip Goalkeepers');
        console.log(`Expected batches: ~${totalBatches}`);
        console.log('');
        const result = await new TestHambourgService().importRowsInBatches({
            limit: this.limit,
            offset: this.offset,
            batchSize: this.batchSize,
            onWarmup: ({ athletes, metrics }) => {
                console.log(`Cache: ${athletes} athletes, ${metrics} period metrics preloaded`);
                console.log('');
            },
            onBatchComplete: (progress) => {
                const pct = ((progress.rowsProcessed / progress.limit) * 100).toFixed(1);
                const elapsedSec = (progress.elapsedMs / 1000).toFixed(1);
                console.log(`[Batch ${progress.batchNumber}/${progress.totalBatches}] ` +
                    `rows ${progress.batchFrom}-${progress.batchTo} | ` +
                    `progress ${progress.rowsProcessed}/${progress.limit} (${pct}%) | ` +
                    `ok ${progress.batchImported} fail ${progress.batchFailed} | ` +
                    `new activities ${progress.batchCreatedActivities} periods ${progress.batchCreatedPeriods} | ` +
                    `${elapsedSec}s (${progress.rowsPerSecond.toFixed(1)} rows/s)`);
                if (progress.batchErrors.length > 0) {
                    console.log(`  Errors (${progress.batchErrors.length}):`);
                    for (const error of progress.batchErrors) {
                        console.log(`    ✗ ${error}`);
                    }
                }
            },
        });
        console.log('');
        console.log('── Summary ──');
        console.log(`Processed: ${result.rowsProcessed}`);
        console.log(`Imported:  ${result.imported}`);
        console.log(`Failed:    ${result.failed}`);
        console.log(`Skipped (non-FBL / GK): ${result.skippedFilter}`);
        console.log(`New sport activities: ${result.createdActivities}`);
        console.log(`New periods:          ${result.createdPeriods}`);
        console.log(`Duration:  ${(result.elapsedMs / 1000).toFixed(1)}s`);
        if (result.errors.length > 0) {
            console.log('');
            console.log('── Errors by type ──');
            for (const [message, rows] of groupErrorsByMessage(result.errors)) {
                console.log(`  [${rows.length}x] ${message}`);
                for (const error of rows.slice(0, 5)) {
                    console.log(`    - ${formatErrorLine(error)}`);
                }
                if (rows.length > 5) {
                    console.log(`    ... +${rows.length - 5} more`);
                }
            }
            const errorsFile = this.errorsFile ?? join(process.cwd(), 'hambourg/import-errors.log');
            const fileContent = result.errors.map(formatErrorLine).join('\n');
            writeFileSync(errorsFile, `${fileContent}\n`);
            console.log('');
            console.log(`Full error log written to ${errorsFile}`);
        }
        console.log('');
        if (result.failed > 0) {
            this.logger.warning(`${result.failed} row(s) failed`);
        }
        else {
            this.logger.success(`${result.imported} row(s) imported`);
        }
    }
}
__decorate([
    flags.number({ description: 'Max rows to import', default: 1000 }),
    __metadata("design:type", Number)
], HambourgImportRows.prototype, "limit", void 0);
__decorate([
    flags.number({
        description: 'Progress log every N rows (50 recommended for ~1000 rows)',
        default: 50,
    }),
    __metadata("design:type", Number)
], HambourgImportRows.prototype, "batchSize", void 0);
__decorate([
    flags.number({ description: 'Skip first N FBL rows (resume import)', default: 0 }),
    __metadata("design:type", Number)
], HambourgImportRows.prototype, "offset", void 0);
__decorate([
    flags.string({ description: 'Write all errors to this file path' }),
    __metadata("design:type", Object)
], HambourgImportRows.prototype, "errorsFile", void 0);
//# sourceMappingURL=hambourg_import_rows.js.map