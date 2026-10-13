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
export default class SapSportsOneImport extends BaseCommand {
    static commandName = 'sapsportsone:import';
    static description = 'Import SAP SportsOne questionnaire answers (Sleep, Befinden, RPE Training pre/post, AT-IT-RT, Status Verletzung)';
    static options = {
        startApp: true,
    };
    async run() {
        const service = SapSportsOneService.fromEnv();
        console.log('');
        console.log('SAP SportsOne questionnaire import');
        console.log('Questions: Sleep, körperliches/mentales Befinden, Anstrengung/RPE Training → pre|post_training_rpe, RPE AT/IT/RT, Status Verletzung');
        if (this.limit > 0) {
            console.log(`limit=${this.limit} mapped answers`);
        }
        console.log('');
        const result = await service.importMappedAnswers({
            maxAnswers: this.limit > 0 ? this.limit : undefined,
        });
        console.log('');
        console.log('── Summary ──');
        console.log(`Answers fetched: ${result.answersFetched}`);
        console.log(`Answers mapped:  ${result.answersMapped}`);
        console.log(`Imported:        ${result.imported}`);
        console.log(`Skipped (no SAP athlete provider): ${result.skippedNoAthlete}`);
        console.log(`Failed:          ${result.failed}`);
        if (result.errors.length > 0) {
            console.log('');
            console.log('── Errors ──');
            for (const error of result.errors.slice(0, 20)) {
                console.log(`  ✗ ${error}`);
            }
            if (result.errors.length > 20) {
                console.log(`  ... +${result.errors.length - 20} more`);
            }
        }
        console.log('');
        if (result.failed > 0 || result.skippedNoAthlete > 0) {
            this.logger.warning(`Imported ${result.imported}, skipped ${result.skippedNoAthlete}, failed ${result.failed}`);
        }
        else {
            this.logger.success(`Imported ${result.imported} answer(s)`);
        }
    }
}
__decorate([
    flags.number({
        description: 'Stop after N mapped answers (0 = all)',
        default: 0,
    }),
    __metadata("design:type", Number)
], SapSportsOneImport.prototype, "limit", void 0);
//# sourceMappingURL=sapsportsone_import.js.map