var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
import { CLUB_PROVIDER_TYPES } from '#constants/club_provider.constants';
import AthleteProvider from '#models_pg/athlete_provider';
import ClubProvider from '#models_pg/club_provider';
import { CatapultService } from '#services/catapult_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import { DateTime } from 'luxon';
export default class CatapultPreview extends BaseCommand {
    static commandName = 'catapult:preview';
    static description = 'Fetch Catapult activities for configured clubs (no persist, no jobs)';
    static options = {
        startApp: true,
    };
    async run() {
        const startDate = DateTime.now().minus({ days: this.days });
        const providers = await CatapultService.getConfiguredCatapultProviders();
        this.logger.info(`configured clubs=${providers.length} from=${startDate.toISO()}`);
        if (providers.length === 0) {
            const all = await ClubProvider.query().where('provider', CLUB_PROVIDER_TYPES.CATAPULT);
            this.logger.error(`No configured Catapult providers (rows=${all.length})`);
            this.exitCode = 1;
            return;
        }
        for (const provider of providers) {
            await provider.load('club');
            let tokenOk = false;
            try {
                const token = provider.accessToken ?? '';
                tokenOk = token.startsWith('eyJ');
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`club=${provider.clubId} (${provider.club?.name ?? '?'}) decrypt failed: ${message}`);
                continue;
            }
            this.logger.info(`club=${provider.clubId} (${provider.club?.name ?? '?'}) teamId=${Boolean(provider.providerTeamId)} jwt=${tokenOk} lastSyncedAt=${provider.lastSyncedAt?.toISO() ?? '-'}`);
            try {
                const service = CatapultService.fromClubProvider(provider);
                const activities = (await service.getCatapultActivities(startDate));
                this.logger.info(`  activities=${activities.length}`);
                for (const activity of activities) {
                    const start = activity.start_time
                        ? DateTime.fromSeconds(activity.start_time).toISO()
                        : '-';
                    this.logger.info(`  - ${start} athletes=${activity.athlete_count ?? '?'} ${activity.name ?? activity.id}`);
                }
                if (!this.stats || activities.length === 0)
                    continue;
                const sample = activities.find((activity) => activity.name?.includes('1st Team')) ?? activities[0];
                const periods = await service.getCatapultData(sample.id);
                const athleteIds = [...new Set(periods.map((period) => period.athlete_id).filter(Boolean))];
                const matched = await AthleteProvider.query()
                    .where('provider', ATHLETE_PROVIDER_TYPES.CATAPULT)
                    .whereIn('providerAthleteId', athleteIds)
                    .preload('athlete', (query) => query.where('clubId', provider.clubId));
                const matchedCount = matched.filter((row) => row.athlete).length;
                this.logger.info(`  stats "${sample.name}" rows=${periods.length} athletes=${athleteIds.length} matchedProviders=${matchedCount}`);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`  fetch failed: ${message}`);
                this.exitCode = 1;
            }
        }
    }
}
__decorate([
    flags.number({ description: 'Lookback days', default: 7 }),
    __metadata("design:type", Number)
], CatapultPreview.prototype, "days", void 0);
__decorate([
    flags.boolean({ description: 'Probe /stats on oldest and newest activity' }),
    __metadata("design:type", Boolean)
], CatapultPreview.prototype, "stats", void 0);
//# sourceMappingURL=catapult_preview.js.map