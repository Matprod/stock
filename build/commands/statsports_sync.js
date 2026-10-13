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
import { StatssportsService } from '#services/statsports_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import { DateTime } from 'luxon';
export default class StatssportsSync extends BaseCommand {
    static commandName = 'statsports:sync';
    static description = 'Fetch STATSports sessions and persist activities/periods';
    static options = {
        startApp: true,
    };
    async run() {
        if (!this.from) {
            this.logger.error('--from is required (YYYY-MM-DD)');
            this.exitCode = 1;
            return;
        }
        const startDate = DateTime.fromISO(this.from, { zone: 'utc' }).startOf('day');
        const endDate = this.to
            ? DateTime.fromISO(this.to, { zone: 'utc' }).endOf('day')
            : DateTime.utc();
        if (!startDate.isValid)
            throw new Error(`Invalid --from ${this.from}`);
        if (!endDate.isValid)
            throw new Error(`Invalid --to ${this.to}`);
        if (endDate < startDate)
            throw new Error('--to must be >= --from');
        const sessionStart = startDate.toUTC().toISO();
        const sessionEnd = endDate.toUTC().toISO();
        if (!sessionStart || !sessionEnd)
            throw new Error('Invalid --from/--to ISO datetime');
        this.logger.info(`club=${this.clubId} ${sessionStart} → ${sessionEnd} chunkDays=${this.chunkDays}`);
        const service = await StatssportsService.fromClubId(this.clubId);
        const result = await service.syncDateRange({
            sessionStart,
            sessionEnd,
            chunkDays: this.chunkDays,
        });
        this.logger.info(`chunks=${result.chunks} bundles=${result.bundles} rows=${result.rows} imported=${result.imported} activities=${result.createdActivities} periods=${result.createdPeriods} eventsCreated=${result.createdEvents} eventsLinked=${result.linkedEvents} skippedNoPlayerId=${result.skippedNoPlayerId} skippedNoAthlete=${result.skippedNoAthlete} failed=${result.failed}`);
    }
}
__decorate([
    flags.string({ description: 'Club id', default: HAMBOURG_CLUB_ID }),
    __metadata("design:type", String)
], StatssportsSync.prototype, "clubId", void 0);
__decorate([
    flags.string({ description: 'From ISO date (inclusive)' }),
    __metadata("design:type", String)
], StatssportsSync.prototype, "from", void 0);
__decorate([
    flags.string({ description: 'To ISO date (optional, default now)' }),
    __metadata("design:type", Object)
], StatssportsSync.prototype, "to", void 0);
__decorate([
    flags.number({ description: 'Chunk size in days', default: 3 }),
    __metadata("design:type", Number)
], StatssportsSync.prototype, "chunkDays", void 0);
//# sourceMappingURL=statsports_sync.js.map