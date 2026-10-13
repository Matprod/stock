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
import { SkillcornerService } from '#services/skillcorner_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
export default class SkillcornerImport extends BaseCommand {
    static commandName = 'skillcorner:import';
    static description = 'Import SkillCorner physical metrics onto day sport activities (name + game_activity + metrics)';
    static options = {
        startApp: true,
    };
    async run() {
        const service = await SkillcornerService.fromClubId(this.clubId || HAMBOURG_CLUB_ID);
        const fromDate = this.from || undefined;
        console.log(`SkillCorner import club_id=${service.maunaClubId} team_id=${service.teamId} matches=${this.matches === 0 ? 'all' : this.matches}${fromDate ? ` from=${fromDate}` : ''}`);
        const result = await service.importPhysical(this.matches, fromDate);
        console.log(`Matches: ${result.matches}`);
        console.log(`Imported: ${result.imported}`);
        console.log(`Activities updated: ${result.activitiesUpdated}`);
        console.log(`Skipped: ${result.skipped}`);
        console.log(`Failed: ${result.failed}`);
        for (const error of result.errors.slice(0, 20)) {
            console.log(`  ✗ ${error}`);
        }
        this.logger.success(`Imported ${result.imported} row(s) from ${result.matches} match(es)`);
    }
}
__decorate([
    flags.string({
        description: 'Mauna club id',
        default: HAMBOURG_CLUB_ID,
    }),
    __metadata("design:type", String)
], SkillcornerImport.prototype, "clubId", void 0);
__decorate([
    flags.number({
        description: 'Number of latest matches to import (0 = all from 2022-06-20)',
        default: 10,
    }),
    __metadata("design:type", Number)
], SkillcornerImport.prototype, "matches", void 0);
__decorate([
    flags.string({
        description: 'Only matches on or after this date (YYYY-MM-DD)',
    }),
    __metadata("design:type", String)
], SkillcornerImport.prototype, "from", void 0);
//# sourceMappingURL=skillcorner_import.js.map