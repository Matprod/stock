var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BOURG_CLUB_ID, VALD_FULL_SYNC_FROM, VALD_REQUEST_DELAY_MS } from '#constants/vald.constants';
import ValdService from '#services/vald_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import { DateTime } from 'luxon';
export default class ValdSync extends BaseCommand {
    static commandName = 'vald:sync';
    static description = 'Backfill VALD ForceDecks tests for a club from a given date';
    static options = {
        startApp: true,
    };
    async run() {
        const start = DateTime.fromISO(this.from, { zone: 'utc' }).startOf('day');
        if (!start.isValid) {
            this.logger.error(`Invalid --from ${this.from}`);
            this.exitCode = 1;
            return;
        }
        const modifiedFromUtc = start.toUTC().toISO();
        if (!modifiedFromUtc) {
            this.logger.error('Could not build modifiedFromUtc');
            this.exitCode = 1;
            return;
        }
        const service = await ValdService.fromClubId(this.clubId);
        this.logger.info(`club=${this.clubId} from=${modifiedFromUtc} delayMs=${this.delayMs}${this.dryRun ? ' dry-run' : ''}`);
        const result = await service.syncClubAthletes({
            modifiedFromUtc,
            delayMs: this.delayMs,
            dryRun: this.dryRun,
        });
        this.logger.info(`athletes=${result.athleteCount} synced=${result.synced} failed=${result.failed} tests=${result.testsImported}`);
        if (result.athleteCount === 0) {
            this.logger.error('No VALD athlete_providers for this club');
            this.exitCode = 1;
        }
    }
}
__decorate([
    flags.string({ description: 'Club id', default: BOURG_CLUB_ID }),
    __metadata("design:type", String)
], ValdSync.prototype, "clubId", void 0);
__decorate([
    flags.string({
        description: 'From ISO date (inclusive, UTC)',
        default: VALD_FULL_SYNC_FROM,
    }),
    __metadata("design:type", String)
], ValdSync.prototype, "from", void 0);
__decorate([
    flags.boolean({ description: 'Fetch tests without writing vald_tests / vald_trials' }),
    __metadata("design:type", Boolean)
], ValdSync.prototype, "dryRun", void 0);
__decorate([
    flags.number({ description: 'Delay between API calls in ms', default: VALD_REQUEST_DELAY_MS }),
    __metadata("design:type", Number)
], ValdSync.prototype, "delayMs", void 0);
//# sourceMappingURL=vald_sync.js.map