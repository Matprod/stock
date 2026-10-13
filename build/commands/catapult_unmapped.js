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
import { SUNDERLAND_CLUB_IDS } from '#constants/chatbot.constants';
import AthleteProvider from '#models_pg/athlete_provider';
import ClubProvider from '#models_pg/club_provider';
import { CatapultService } from '#services/catapult_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import axios from 'axios';
import { DateTime } from 'luxon';
const CATAPULT_BASE_URL = 'https://connect-eu.catapultsports.com/api/v6';
const SUNDERLAND_CLUB_ID = SUNDERLAND_CLUB_IDS[0];
export default class CatapultUnmapped extends BaseCommand {
    static commandName = 'catapult:unmapped';
    static description = 'List Catapult athletes without athlete_providers (Sunderland)';
    static options = { startApp: true };
    async run() {
        const provider = await ClubProvider.query()
            .where('clubId', SUNDERLAND_CLUB_ID)
            .where('provider', 'catapult')
            .preload('club')
            .first();
        if (!provider?.accessToken || !provider.providerTeamId) {
            this.logger.error('No Sunderland Catapult club provider');
            this.exitCode = 1;
            return;
        }
        const headers = {
            'Authorization': `Bearer ${provider.accessToken}`,
            'Accept': 'application/json',
        };
        const rosterResponse = await axios.get(`${CATAPULT_BASE_URL}/athletes`, {
            params: { team_id: provider.providerTeamId },
            headers,
        });
        const roster = Array.isArray(rosterResponse.data) ? rosterResponse.data : [];
        const dbProviders = await AthleteProvider.query()
            .where('provider', ATHLETE_PROVIDER_TYPES.CATAPULT)
            .whereNotNull('providerAthleteId')
            .preload('athlete', (query) => query.where('clubId', SUNDERLAND_CLUB_ID));
        const mappedIds = new Set(dbProviders
            .filter((row) => row.athlete && row.providerAthleteId)
            .map((row) => row.providerAthleteId));
        this.logger.info(`club=${provider.club?.name} roster=${roster.length} mappedProviders=${mappedIds.size}`);
        const unmappedRoster = roster.filter((athlete) => athlete.id && !mappedIds.has(athlete.id));
        this.logger.info(`unmapped on full Catapult roster: ${unmappedRoster.length}`);
        for (const athlete of unmappedRoster) {
            this.logger.info(`  roster ${this.athleteLabel(athlete)} id=${athlete.id}`);
        }
        const service = CatapultService.fromClubProvider(provider);
        const from = DateTime.now().minus({ days: this.days });
        const activities = (await service.getCatapultActivities(from));
        const firstTeam = activities.filter((activity) => (activity.name ?? '').toLowerCase().includes('1st team'));
        const seen = new Map();
        for (const [index, activity] of firstTeam.entries()) {
            if (index > 0)
                await new Promise((resolve) => setTimeout(resolve, 1500));
            const periods = await service.getCatapultData(activity.id);
            for (const period of periods) {
                if (!period.athlete_id)
                    continue;
                const current = seen.get(period.athlete_id);
                if (current) {
                    current.sessions++;
                    continue;
                }
                seen.set(period.athlete_id, {
                    name: period.athlete_name || period.athlete_id,
                    sessions: 1,
                });
            }
        }
        this.logger.info(`1st team window ${this.days}d activities=${firstTeam.length} uniqueAthletes=${seen.size}`);
        const unmappedFirstTeam = [...seen.entries()].filter(([id]) => !mappedIds.has(id));
        this.logger.info(`unmapped on 1st team: ${unmappedFirstTeam.length}`);
        for (const [id, info] of unmappedFirstTeam.sort((a, b) => a[1].name.localeCompare(b[1].name))) {
            this.logger.info(`  1st ${info.name} id=${id} rows=${info.sessions}`);
        }
    }
    athleteLabel(athlete) {
        const name = `${athlete.first_name ?? ''} ${athlete.last_name ?? ''}`.trim();
        return name || athlete.name || athlete.id;
    }
}
__decorate([
    flags.number({ description: 'Lookback days for first-team stats', default: 14 }),
    __metadata("design:type", Number)
], CatapultUnmapped.prototype, "days", void 0);
//# sourceMappingURL=catapult_unmapped.js.map