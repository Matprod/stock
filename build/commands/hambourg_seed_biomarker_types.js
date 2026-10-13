var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { DIAGNOSTIK_BIOMARKER_DEFS } from '#constants/diagnostik.constants';
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants';
import BiomarkerType from '#models_pg/biomarker_type';
import db from '@adonisjs/lucid/services/db';
import { BaseCommand, flags } from '@adonisjs/core/ace';
export default class HambourgSeedBiomarkerTypes extends BaseCommand {
    static commandName = 'hambourg:seed-biomarker-types';
    static description = 'Create biomarker_types for Hamburg diagnostik.xlsx columns';
    static options = {
        startApp: true,
    };
    async run() {
        const entries = Object.values(DIAGNOSTIK_BIOMARKER_DEFS);
        this.logger.info(`${entries.length} diagnostik biomarker types to seed`);
        let created = 0;
        let updated = 0;
        let unchanged = 0;
        let linked = 0;
        for (const def of entries) {
            if (this.dryRun) {
                this.logger.info(`  ${def.name} (${def.unit})`);
                continue;
            }
            let type = await BiomarkerType.findBy('name', def.name);
            if (!type) {
                type = await BiomarkerType.create({ name: def.name, unit: def.unit });
                created++;
            }
            else if (type.unit !== def.unit) {
                type.unit = def.unit;
                await type.save();
                updated++;
            }
            else {
                unchanged++;
            }
            const existingLink = await db
                .from('biomarker_type_clubs')
                .where('biomarker_type_id', type.id)
                .where('club_id', HAMBOURG_CLUB_ID)
                .first();
            if (!existingLink) {
                await type.related('clubs').attach([HAMBOURG_CLUB_ID]);
                linked++;
            }
        }
        if (this.dryRun) {
            this.logger.info(`Dry run: would seed ${entries.length} diagnostik biomarker types`);
            return;
        }
        this.logger.success(`Done: ${created} created, ${updated} updated, ${unchanged} unchanged, ${linked} club links`);
    }
}
__decorate([
    flags.boolean({ description: 'List types without writing to DB' }),
    __metadata("design:type", Boolean)
], HambourgSeedBiomarkerTypes.prototype, "dryRun", void 0);
//# sourceMappingURL=hambourg_seed_biomarker_types.js.map