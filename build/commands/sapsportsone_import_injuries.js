var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { SapSportsOneService } from '#services/sapsportsone_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
export default class SapSportsOneImportInjuries extends BaseCommand {
    static commandName = 'sapsportsone:import-injuries';
    static description = 'Import SAP SportsOne medicalEvents (INJURY) via /external/export/med/v1 into injuries';
    static options = {
        startApp: true,
    };
    async run() {
        const service = SapSportsOneService.fromEnv();
        console.log('');
        console.log(`SAP SportsOne medical injuries import${this.dryRun ? ' (dry-run)' : ''}`);
        console.log('Source: /external/export/med/v1/medicalEvents (EventType=INJURY)');
        console.log('');
        const result = await service.importMedicalInjuries({ dryRun: this.dryRun });
        console.log('');
        console.log('── Summary ──');
        console.log(`Events fetched:       ${result.eventsFetched}`);
        console.log(`INJURY events:        ${result.injuryEvents}`);
        console.log(`Imported:             ${result.imported}`);
        console.log(`Created injury types: ${result.createdTypes}`);
        console.log(`Skipped existing:     ${result.skippedExisting}`);
        console.log(`Mechanism synced:     ${result.mechanismSynced}`);
        console.log(`Skipped no athlete:   ${result.skippedNoAthlete}`);
        console.log(`Skipped no start:     ${result.skippedNoStart}`);
        console.log(`Section → N/A:        ${result.sectionNa}`);
        console.log(`Failed:               ${result.failed}`);
        if (result.errors.length > 0) {
            console.log('');
            console.log(`── Errors (showing ${Math.min(this.show, result.errors.length)}/${result.errors.length}) ──`);
            for (const error of result.errors.slice(0, this.show)) {
                console.log(`  ✗ ${error}`);
            }
        }
        console.log('');
        if (this.dryRun) {
            this.logger.info(`Dry run: would import ${result.imported} injury(ies), sync ${result.mechanismSynced} mechanism(s)`);
            return;
        }
        if (result.failed > 0 || result.skippedNoAthlete > 0) {
            this.logger.warning(`Imported ${result.imported}, skipped athletes ${result.skippedNoAthlete}, failed ${result.failed}`);
        }
        else {
            this.logger.success(`Imported ${result.imported} injury(ies)`);
        }
    }
}
__decorate([
    flags.boolean({
        description: 'Dry run — fetch and map only, do not write injuries / types',
    }),
    __metadata("design:type", Boolean)
], SapSportsOneImportInjuries.prototype, "dryRun", void 0);
__decorate([
    flags.number({
        description: 'Number of errors printed',
        default: 20,
    }),
    __metadata("design:type", Number)
], SapSportsOneImportInjuries.prototype, "show", void 0);
//# sourceMappingURL=sapsportsone_import_injuries.js.map