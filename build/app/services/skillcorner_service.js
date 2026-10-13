import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
import { CLUB_PROVIDER_TYPES } from '#constants/club_provider.constants';
import { mapSkillcornerPhysicalMetrics, SKILLCORNER_API_CONFIG, SKILLCORNER_IMPORT_MIN_DATE, SKILLCORNER_PHYSICAL_METRIC_MAP, } from '#constants/skillcorner.constants';
import { SPORT_ACTIVITY_METRIC_SOURCE } from '#constants/sport_activity_metrics.constants';
import { MetricDomain } from '#contracts/metric';
import AthleteProvider from '#models_pg/athlete_provider';
import ClubProvider from '#models_pg/club_provider';
import Day from '#models_pg/day';
import SportActivity from '#models_pg/sport_activity';
import SportActivityMetric from '#models_pg/sport_activity_metric';
import { EventService } from '#services/event_service';
import { MetricService } from '#services/metric_service';
import axios from 'axios';
import { DateTime } from 'luxon';
export class SkillcornerService {
    maunaClubId;
    teamId;
    client;
    metrics = new MetricService(MetricDomain.SPORT_ACTIVITY);
    eventService = new EventService();
    constructor(config) {
        this.maunaClubId = config.maunaClubId;
        this.teamId = config.teamId;
        this.client = axios.create({
            baseURL: SKILLCORNER_API_CONFIG.baseUrl,
            timeout: SKILLCORNER_API_CONFIG.timeoutMs,
            auth: { username: config.username, password: config.password },
            headers: { Accept: 'application/json' },
        });
    }
    static fromClubProvider(provider) {
        if (!provider.accessToken || !provider.accessTokenSecret || !provider.providerTeamId) {
            throw new Error(`SkillCorner provider misconfigured for club ${provider.clubId}: accessToken (username), accessTokenSecret (password) and providerTeamId are required`);
        }
        const teamId = Number(provider.providerTeamId);
        if (!Number.isFinite(teamId) || teamId <= 0) {
            throw new Error(`SkillCorner provider misconfigured for club ${provider.clubId}: providerTeamId must be a positive number`);
        }
        return new SkillcornerService({
            maunaClubId: provider.clubId,
            teamId,
            username: provider.accessToken,
            password: provider.accessTokenSecret,
        });
    }
    static async fromClubId(clubId) {
        const provider = await ClubProvider.query()
            .where('clubId', clubId)
            .where('provider', CLUB_PROVIDER_TYPES.SKILLCORNER)
            .firstOrFail();
        return SkillcornerService.fromClubProvider(provider);
    }
    static async getConfiguredProviders() {
        return ClubProvider.query()
            .where('provider', CLUB_PROVIDER_TYPES.SKILLCORNER)
            .whereNotNull('accessToken')
            .whereNotNull('accessTokenSecret')
            .whereNotNull('providerTeamId');
    }
    static async syncAllClubs(fromDate) {
        const providers = await SkillcornerService.getConfiguredProviders();
        const results = [];
        for (const provider of providers) {
            try {
                const service = SkillcornerService.fromClubProvider(provider);
                const result = await service.importPhysical(0, fromDate);
                provider.lastSyncedAt = DateTime.now();
                await provider.save();
                results.push({ clubId: provider.clubId, ...result });
            }
            catch (error) {
                results.push({
                    clubId: provider.clubId,
                    matches: 0,
                    imported: 0,
                    activitiesUpdated: 0,
                    skipped: 0,
                    failed: 0,
                    errors: [],
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return results;
    }
    async fetchPhysical() {
        return this.getAll('/physical/', {
            team: this.teamId,
            page_size: SKILLCORNER_API_CONFIG.pageSize,
        });
    }
    async importPhysical(matchLimit = 10, fromDate) {
        const startedAt = Date.now();
        const minDate = fromDate || SKILLCORNER_IMPORT_MIN_DATE;
        console.log(`  fetching /physical...`);
        const physical = await this.fetchPhysical();
        const matchDates = new Map();
        for (const row of physical) {
            const matchId = row.match_id == null ? null : String(row.match_id);
            const matchDate = row.match_date ? String(row.match_date) : null;
            if (!matchId || !matchDate || matchDate < minDate)
                continue;
            if (!matchDates.has(matchId) || matchDate > matchDates.get(matchId)) {
                matchDates.set(matchId, matchDate);
            }
        }
        const orderedMatchIds = [...matchDates.entries()]
            .sort((a, b) => b[1].localeCompare(a[1]))
            .map(([id]) => id);
        const selectedMatchIds = new Set(matchLimit > 0 ? orderedMatchIds.slice(0, matchLimit) : orderedMatchIds);
        const rows = physical.filter((row) => selectedMatchIds.has(String(row.match_id ?? '')));
        console.log(`  matches in range (>=${minDate}): ${orderedMatchIds.length} → importing ${selectedMatchIds.size}`);
        console.log(`  player-rows to process: ${rows.length}`);
        const providers = await AthleteProvider.query()
            .where('provider', ATHLETE_PROVIDER_TYPES.SKILLCORNER)
            .whereNotNull('providerAthleteId')
            .preload('athlete', (query) => query.where('clubId', this.maunaClubId));
        const athletes = new Map(providers
            .filter((provider) => provider.providerAthleteId && provider.athlete)
            .map((provider) => [String(provider.providerAthleteId), provider.athlete]));
        const athleteIds = new Set();
        const dates = new Set();
        const pending = [];
        let skipped = 0;
        for (const row of rows) {
            const playerId = row.player_id == null ? null : String(row.player_id);
            const matchDate = DateTime.fromISO(String(row.match_date ?? ''), { zone: 'utc' });
            if (!playerId || !matchDate.isValid) {
                skipped++;
                continue;
            }
            const athlete = athletes.get(playerId);
            if (!athlete) {
                skipped++;
                continue;
            }
            const date = matchDate.toISODate();
            athleteIds.add(athlete.id);
            dates.add(date);
            pending.push({
                playerId,
                athleteId: athlete.id,
                date,
                matchName: row.match_name ? String(row.match_name) : null,
                label: String(row.player_name || playerId),
                payload: Object.fromEntries(Object.entries(mapSkillcornerPhysicalMetrics(row)).filter(([, value]) => value !== null)),
            });
        }
        console.log(`  pending writes: ${pending.length} (skipped pre-resolve: ${skipped})`);
        const days = athleteIds.size > 0 && dates.size > 0
            ? await Day.query()
                .whereIn('athleteId', [...athleteIds])
                .whereIn('dateOfDay', [...dates])
            : [];
        const dayByKey = new Map(days.map((day) => [`${day.athleteId}|${day.dateOfDay.toISODate()}`, day]));
        const dayIds = days.map((day) => day.id);
        const allActivities = dayIds.length > 0
            ? await SportActivity.query().whereIn('dayId', dayIds).orderBy('createdAt', 'asc')
            : [];
        const activitiesByDay = new Map();
        for (const activity of allActivities) {
            const list = activitiesByDay.get(activity.dayId);
            if (list)
                list.push(activity);
            else
                activitiesByDay.set(activity.dayId, [activity]);
        }
        const activityByDayId = new Map();
        for (const [dayId, dayActivities] of activitiesByDay) {
            activityByDayId.set(dayId, dayActivities.find((a) => a.gameActivity === true) ??
                dayActivities.find((a) => a.dataSource === 'statsports') ??
                dayActivities[0]);
        }
        const metricNames = Object.values(SKILLCORNER_PHYSICAL_METRIC_MAP);
        const metricRows = await SportActivityMetric.query().whereIn('name', metricNames);
        const metricsCatalog = new Map(metricRows.map((metric) => [metric.name, { id: metric.id, dataType: metric.dataType }]));
        let imported = 0;
        let activitiesUpdated = 0;
        let failed = 0;
        const errors = [];
        const touchedActivities = new Set();
        const calendarSynced = new Set();
        const writeStartedAt = Date.now();
        const logEvery = Math.max(25, Math.floor(pending.length / 20) || 25);
        for (let i = 0; i < pending.length; i++) {
            const item = pending[i];
            const day = dayByKey.get(`${item.athleteId}|${item.date}`);
            if (!day) {
                skipped++;
                continue;
            }
            const activity = activityByDayId.get(day.id);
            if (!activity) {
                skipped++;
                continue;
            }
            try {
                let dirty = false;
                if (item.matchName && activity.activityName !== item.matchName) {
                    activity.activityName = item.matchName;
                    dirty = true;
                }
                if (activity.gameActivity !== true) {
                    activity.gameActivity = true;
                    dirty = true;
                }
                if (dirty) {
                    await activity.save();
                    if (!touchedActivities.has(activity.id)) {
                        touchedActivities.add(activity.id);
                        activitiesUpdated++;
                    }
                }
                if (Object.keys(item.payload).length > 0) {
                    await this.metrics.storeEntityMetrics(activity.id, item.payload, undefined, {
                        source: SPORT_ACTIVITY_METRIC_SOURCE.SKILLCORNER,
                        metricsCatalog,
                    });
                }
                if (!calendarSynced.has(activity.id)) {
                    calendarSynced.add(activity.id);
                    try {
                        await this.eventService.syncMatchActivityToCalendar(activity);
                    }
                    catch (error) {
                        console.log(`  calendar sync failed for activity ${activity.id}: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
                imported++;
            }
            catch (error) {
                failed++;
                errors.push(`${item.label} | ${error instanceof Error ? error.message : String(error)}`);
            }
            if ((i + 1) % logEvery === 0 || i + 1 === pending.length) {
                const elapsedSec = ((Date.now() - writeStartedAt) / 1000).toFixed(1);
                console.log(`  progress ${i + 1}/${pending.length} imported=${imported} skipped=${skipped} failed=${failed} (${elapsedSec}s)`);
            }
        }
        console.log(`  done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
        return {
            matches: selectedMatchIds.size,
            imported,
            activitiesUpdated,
            skipped,
            failed,
            errors,
        };
    }
    async getAll(path, params) {
        const results = [];
        let url = path;
        let requestParams = params;
        let page = 0;
        while (url) {
            page++;
            const { data } = await this.client.get(url, { params: requestParams });
            if (Array.isArray(data)) {
                return data.filter((item) => typeof item === 'object' && item !== null);
            }
            const pageData = data;
            const batch = Array.isArray(pageData.results) ? pageData.results : [];
            results.push(...batch.filter((item) => typeof item === 'object' && item !== null));
            url = typeof pageData.next === 'string' ? pageData.next : null;
            requestParams = undefined;
            if (page % 5 === 0 || !url) {
                console.log(`  ${path}: ${results.length} row(s)${url ? ' so far...' : ''}`);
            }
        }
        return results;
    }
}
//# sourceMappingURL=skillcorner_service.js.map