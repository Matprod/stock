var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { CLUB_PROVIDER_TYPES } from '#constants/club_provider.constants';
import ClubProvider from '#models_pg/club_provider';
import { StatssportsService } from '#services/statsports_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import { DateTime } from 'luxon';
export default class StatssportsPreview extends BaseCommand {
    static commandName = 'statsports:preview';
    static description = 'Fetch STATSports drill rows for a club provider';
    static options = {
        startApp: true,
    };
    async run() {
        const to = this.to ? DateTime.fromISO(this.to, { zone: 'utc' }) : DateTime.utc();
        const from = this.from
            ? DateTime.fromISO(this.from, { zone: 'utc' })
            : to.minus({ days: 7 }).startOf('day');
        if (!from.isValid || !to.isValid) {
            throw new Error('Invalid --from/--to ISO datetime');
        }
        if (to < from) {
            throw new Error('--to must be >= --from');
        }
        const sessionStart = from.toUTC().toISO();
        const sessionEnd = to.toUTC().toISO();
        if (!sessionStart || !sessionEnd) {
            throw new Error('Invalid --from/--to ISO datetime');
        }
        const maxRows = this.limit > 0 ? this.limit : undefined;
        const providers = await this.resolveProviders();
        if (providers.length === 0) {
            this.logger.error('No STATSports club provider configured (accessToken required)');
            this.exitCode = 1;
            return;
        }
        this.logger.info(`from=${sessionStart} to=${sessionEnd} chunkDays=${this.chunkDays}`);
        for (const provider of providers) {
            const service = StatssportsService.fromClubProvider(provider);
            const result = await service.fetchMappedRows({
                sessionStart,
                sessionEnd,
                chunkDays: this.chunkDays,
                maxRows,
            });
            this.logger.info(`club=${result.clubId} chunks=${result.chunks} sessions=${result.bundles} rows=${result.rows.length}`);
            for (const [index, row] of result.rows.slice(0, this.preview).entries()) {
                const metricPreview = Object.fromEntries(Object.entries(row)
                    .filter(([key, value]) => key.startsWith('kpi_') && value !== null)
                    .slice(0, 8));
                this.logger.info(`preview ${index + 1}`);
                this.logger.info(JSON.stringify({
                    player: `${row.player_firstName ?? ''} ${row.player_lastName ?? ''}`.trim(),
                    session_date: row.session_date,
                    session_type: row.session_type,
                    drill_name: row.drill_name,
                    metrics: metricPreview,
                }));
            }
        }
    }
    async resolveProviders() {
        if (!this.clubId) {
            return StatssportsService.getConfiguredProviders();
        }
        const provider = await ClubProvider.query()
            .where('clubId', this.clubId)
            .where('provider', CLUB_PROVIDER_TYPES.STATSPORTS)
            .first();
        if (!provider?.accessToken) {
            throw new Error(`No STATSports club provider with accessToken for club ${this.clubId}`);
        }
        return [provider];
    }
}
__decorate([
    flags.string({ description: 'Club id (omit to fetch all configured STATSports clubs)' }),
    __metadata("design:type", Object)
], StatssportsPreview.prototype, "clubId", void 0);
__decorate([
    flags.string({ description: 'Session start ISO datetime' }),
    __metadata("design:type", Object)
], StatssportsPreview.prototype, "from", void 0);
__decorate([
    flags.string({ description: 'Session end ISO datetime' }),
    __metadata("design:type", Object)
], StatssportsPreview.prototype, "to", void 0);
__decorate([
    flags.number({ description: 'Chunk size in days', default: 7 }),
    __metadata("design:type", Number)
], StatssportsPreview.prototype, "chunkDays", void 0);
__decorate([
    flags.number({ description: 'Max rows to keep (0 = all)', default: 0 }),
    __metadata("design:type", Number)
], StatssportsPreview.prototype, "limit", void 0);
__decorate([
    flags.number({ description: 'Number of rows to print', default: 3 }),
    __metadata("design:type", Number)
], StatssportsPreview.prototype, "preview", void 0);
//# sourceMappingURL=statsports_preview.js.map