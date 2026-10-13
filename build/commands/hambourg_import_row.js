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
export default class HambourgImportRow extends BaseCommand {
    static commandName = 'hambourg:import-row';
    static description = 'Import N Excel rows as sport activities (STATSports test import)';
    static options = {
        startApp: true,
    };
    async run() {
        const service = new TestHambourgService();
        const result = await service.importRowsInBatches({
            limit: this.limit,
            batchSize: 1,
            onBatchComplete: (progress) => {
                console.log(`Row ${progress.rowsProcessed}: ok=${progress.batchImported} fail=${progress.batchFailed}` +
                    (progress.batchErrors.length > 0 ? ` — ${progress.batchErrors.at(-1)}` : ''));
            },
        });
        this.logger.success(`Done: ${result.imported} imported, ${result.failed} failed`);
    }
}
__decorate([
    flags.number({ description: 'Number of Excel rows to import', default: 1 }),
    __metadata("design:type", Number)
], HambourgImportRow.prototype, "limit", void 0);
//# sourceMappingURL=hambourg_import_row.js.map