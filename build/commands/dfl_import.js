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
import { DflService } from '#services/dfl_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
export default class DflImport extends BaseCommand {
    static commandName = 'dfl:import';
    static description = 'Import DFL match metrics (create day/activity if missing, else attach to existing match/statsports activity)';
    static options = {
        startApp: true,
    };
    async run() {
        const service = await DflService.fromClubId(this.clubId || HAMBOURG_CLUB_ID);
        const season = this.season || undefined;
        const fromDate = this.from || undefined;
        const matchLimit = season?.toLowerCase() === 'all' && this.matches === 10 ? 0 : this.matches;
        console.log(`DFL import club_id=${service.maunaClubId} dfl_club_id=${service.dflClubId} matches=${matchLimit === 0 ? 'all' : matchLimit}${season ? ` season=${season}` : ''}${fromDate ? ` from=${fromDate}` : ''}`);
        const result = await service.importClub(matchLimit, season, fromDate);
        console.log(`Matches: ${result.matches}`);
        console.log(`Imported: ${result.imported}`);
        console.log(`Activities created: ${result.activitiesCreated}`);
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
        description: 'Mauna club id (or DFL-CLU-* for legacy)',
        default: HAMBOURG_CLUB_ID,
    }),
    __metadata("design:type", String)
], DflImport.prototype, "clubId", void 0);
__decorate([
    flags.number({
        description: 'Max latest played matches to import (0 = no limit)',
        default: 10,
    }),
    __metadata("design:type", Number)
], DflImport.prototype, "matches", void 0);
__decorate([
    flags.string({
        description: 'Season name (e.g. 2025/2026), SeasonId, or "all"',
    }),
    __metadata("design:type", String)
], DflImport.prototype, "season", void 0);
__decorate([
    flags.string({
        description: 'Only matches on or after this date (YYYY-MM-DD)',
    }),
    __metadata("design:type", String)
], DflImport.prototype, "from", void 0);
//# sourceMappingURL=dfl_import.js.map