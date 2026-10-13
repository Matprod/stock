var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants';
import Injury from '#models_pg/injury';
import { deriveRehabMechanismOrNull, joinInjuryText, resolveTissue, } from '#utils/injury_rules';
import { BaseCommand, flags } from '@adonisjs/core/ace';
function isRehabEpisode(injury) {
    return !injury.context?.trim() && !injury.note?.trim();
}
export default class HambourgBackfillInjuryFields extends BaseCommand {
    static commandName = 'hambourg:backfill-injury-fields';
    static description = 'Fill empty tissue on Hamburg injuries; rehab-only mechanism (SAP mechanism comes from InjuryTypeText)';
    static options = {
        startApp: true,
    };
    async run() {
        const injuries = await Injury.query()
            .whereHas('athlete', (query) => query.where('clubId', HAMBOURG_CLUB_ID))
            .where((query) => {
            query
                .whereNull('tissue')
                .orWhere('tissue', '')
                .orWhereNull('mechanism')
                .orWhere('mechanism', '');
        })
            .orderBy('dateOfInjury', 'asc');
        let tissueUpdated = 0;
        let mechanismUpdated = 0;
        const samples = [];
        for (const injury of injuries) {
            const text = joinInjuryText(injury.pathology, injury.note);
            const updates = {};
            if (!injury.tissue?.trim()) {
                const tissue = resolveTissue(null, text);
                if (tissue) {
                    updates.tissue = tissue;
                    tissueUpdated++;
                }
            }
            if (!injury.mechanism?.trim() && isRehabEpisode(injury)) {
                const mechanism = deriveRehabMechanismOrNull(text);
                if (mechanism) {
                    updates.mechanism = mechanism;
                    mechanismUpdated++;
                }
            }
            if (Object.keys(updates).length === 0)
                continue;
            if (samples.length < this.show) {
                samples.push(`${injury.dateOfInjury?.toISODate() ?? '?'} | ${injury.pathology ?? 'N/A'} → tissue=${updates.tissue ?? injury.tissue ?? '—'} mechanism=${updates.mechanism ?? injury.mechanism ?? '—'}`);
            }
            if (!this.dryRun) {
                injury.merge(updates);
                await injury.save();
            }
        }
        console.log('');
        console.log(`Hamburg injuries scanned: ${injuries.length}${this.dryRun ? ' (dry-run)' : ''}`);
        console.log(`Tissue filled: ${tissueUpdated}`);
        console.log(`Rehab mechanism filled: ${mechanismUpdated}`);
        console.log('SAP mechanism: run `node ace sapsportsone:import-injuries` to overwrite with InjuryTypeText');
        if (samples.length > 0) {
            console.log('');
            console.log(`Sample updates (${samples.length})`);
            for (const line of samples) {
                console.log(`  - ${line}`);
            }
        }
        console.log('');
        if (this.dryRun) {
            this.logger.info(`Dry run: would update tissue=${tissueUpdated}, mechanism=${mechanismUpdated}`);
        }
        else {
            this.logger.success(`Updated tissue=${tissueUpdated}, mechanism=${mechanismUpdated}`);
        }
    }
}
__decorate([
    flags.boolean({
        description: 'Preview updates without writing',
        default: false,
    }),
    __metadata("design:type", Boolean)
], HambourgBackfillInjuryFields.prototype, "dryRun", void 0);
__decorate([
    flags.number({
        description: 'Number of sample updates to print',
        default: 15,
    }),
    __metadata("design:type", Number)
], HambourgBackfillInjuryFields.prototype, "show", void 0);
//# sourceMappingURL=hambourg_backfill_injury_fields.js.map