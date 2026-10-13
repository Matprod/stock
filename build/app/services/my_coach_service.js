import axios from 'axios';
import Athlete from '#models_pg/athlete';
import SportActivity from '#models_pg/sport_activity';
import Sleep from '#models_pg/sleep';
import HealthRating from '#models_pg/health_rating';
import HealthPain from '#models_pg/health_pain';
import { DateTime } from 'luxon';
import PlayerPosition from '#models_pg/player_position';
import env from '#start/env';
import BodymetricsHistory from '#models_pg/bodymetrics_history';
import Period from '#models_pg/period';
import { GPS_PERIOD_METRICS } from '#constants/sport_activity_period_metrics.constants';
import { MetricDomain } from '#contracts/metric';
import { MetricService } from '#services/metric_service';
import ClubProvider from '#models_pg/club_provider';
import { CLUB_PROVIDER_TYPES } from '#constants/club_provider.constants';
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
import AthleteService from '#services/athlete_service';
import { toSportActivityCreatePayload } from '../utils/my_coach_sport_activity.js';
const VARIABLE_MAPPINGS = {
    sportactivity_sportactivity: {
        'f0a750a5-c82f-4f5d-8cd5-c7103aecf231': 'distance',
        'a6ef83b9-b7d8-4de2-bbb1-f9bf51ce9062': 'active_calories',
        '41f00945-567c-4bdb-ac7a-36d23a79c3b7': 'distance_0_7_kmh',
        '61b2cc4b-8a78-468e-aaa8-3327d294355e': 'distance_7_14_kmh',
        'ef9c15fd-3194-4ba0-81dc-a51be7e98fa5': 'distance_14_19_kmh',
        'a72f0fda-7080-49f9-a3ff-713ae11069a0': 'distance_19_25_kmh',
        '1bbbfa76-5356-4cb4-a5d6-76d8eecf0caa': 'distance_25_plus_kmh',
        'f8cc43ea-0d11-463e-9a40-2f8bd62d91b8': 'nb_efforts_above_19_8_kmh',
        'D21C6C3B-E2B8-416F-86D2-E98CE670075B': 'nb_efforts_above_25_kmh',
        'e34dc369-a50c-4480-a500-21a0bd4c0ead': 'nb_efforts_above_25_kmh',
        '3f2911fa-2647-4363-a7e4-8d4fd8ef2e15': 'top_speed',
        '4e9596ee-0758-45c2-8a8c-e37f8e4ea119': 'vmax_acceleration',
        'c0c09f2c-1b6e-4526-94be-1a5f814bda1f': 'vmax_deceleration',
        '26769015-5a90-46ea-88c0-dce5a1d5b8fa': 'nb_decelerations_above_3ms2',
        '2bc206bb-0301-4c84-91eb-b6dbb559f1e0': 'nb_decelerations_above_3ms2',
        '0de1883b-964e-4242-b6de-c1e34152fb1e': 'nb_accelerations_above_3ms2',
        'a246d3ae-c427-46b0-a560-5db098f84366': 'nb_accelerations_above_3ms2',
        '5911c64a-1532-11eb-adc1-0242ac120002': 'rpe',
        '4d79bded-55a6-4cbe-aecc-fc8304b84223': 'duration',
    },
    sleeps: {
        '22487e35-e3e3-4435-ae8d-4c2ce72ff490': 'quality_rating',
    },
    health_health: {
        '57ebd4de-48f8-4a5a-b814-97878722d7a2': 'stress_rating',
        'af8242a5-b696-44ad-8434-093b6a412005': 'energy_rating',
    },
    health_painhealth: {
        '8f552903-8c84-40be-b3e3-b1eeca714565': 'rating',
    },
    base_athlete: {
        '92fd672d-d017-11eb-a0eb-42010a84005e': 'fat_percentage',
        '92fe78b3-d017-11eb-a0eb-42010a84005e': 'height',
        '92fe34c1-d017-11eb-a0eb-42010a84005e': 'weight',
    },
};
const VARIABLE_ID_TO_TABLE = Object.entries(VARIABLE_MAPPINGS).reduce((acc, [table, mappings]) => {
    Object.entries(mappings).forEach(([variableId, fieldName]) => {
        acc[variableId] = { table, fieldName };
    });
    return acc;
}, {});
export class MyCoachService {
    baseUrl = env.get('MY_COACH_BASE_URL');
    apiKey = env.get('MY_COACH_API_KEY');
    apiKeyId = env.get('MY_COACH_API_KEY_ID');
    periodMetricService = new MetricService(MetricDomain.PERIOD);
    athleteService = new AthleteService();
    async fetchMyCoachData(startDate, endDate, eventTypes, playerId) {
        try {
            console.log('Fetching MyCoach data with params:', {
                startDate,
                endDate,
                eventTypes,
                playerId,
            });
            const params = {
                startDate,
                endDate,
                eventTypes,
            };
            const response = await axios.get(`${this.baseUrl}/analysis-variables`, {
                params,
                headers: {
                    'api-key': this.apiKey,
                    'X-Api-Key-Id': this.apiKeyId,
                },
            });
            return this.processMyCoachData(response.data, playerId);
        }
        catch (error) {
            console.error('Error fetching MyCoach data:', error);
            throw error;
        }
    }
    async fetchPlayerDataByTimeRange(isFetchPast, playerId) {
        const eventTypes = 'training,game,test_result_session,player_monitoring';
        let data;
        if (isFetchPast) {
            const startDate = DateTime.fromISO('2024-07-26T00:00:00.000Z');
            const endDate = DateTime.now().set({ hour: 11, minute: 0, second: 0, millisecond: 0 });
            const results = [];
            let currentStart = startDate;
            while (currentStart < endDate) {
                const currentEnd = currentStart.endOf('month').plus({ days: 1 }).startOf('day');
                const monthEnd = currentEnd > endDate ? endDate : currentEnd;
                const formattedStartDate = currentStart.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
                const formattedEndDate = monthEnd.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
                console.log(`Fetching data from ${formattedStartDate} to ${formattedEndDate}`);
                const monthData = await this.fetchMyCoachData(formattedStartDate, formattedEndDate, eventTypes, playerId);
                results.push(monthData);
                currentStart = monthEnd;
            }
            data = results;
        }
        else {
            const endDate = DateTime.now().set({ hour: 11, minute: 0, second: 0, millisecond: 0 });
            const startDate = endDate.minus({ days: 1 });
            const formattedEndDate = endDate.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
            const formattedStartDate = startDate.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
            data = await this.fetchMyCoachData(formattedStartDate, formattedEndDate, eventTypes, playerId);
        }
        return data;
    }
    async processInitialData(data, athleteMap, relevantTeamIds) {
        console.log('Processing initial data...');
        console.log('Processing player positions...');
        for (const player of data.players) {
            if (player.position && player.position.name) {
                const athlete = athleteMap.get(player.id);
                if (athlete) {
                    await athlete.load('club');
                    const sportId = athlete.club?.sportId;
                    if (sportId) {
                        const position = await PlayerPosition.firstOrCreate({
                            name: player.position.name,
                            sportId,
                        }, {
                            name: player.position.name,
                            sportId,
                        });
                        athlete.playerPositionId = position.id;
                        await athlete.save();
                        break;
                    }
                }
            }
        }
        const dayGroups = new Map();
        const durationMap = {};
        for (const event of data.events) {
            if (!relevantTeamIds.includes(event.teamId)) {
                continue;
            }
            const eventDate = DateTime.fromISO(event.startDate);
            if (!eventDate.isValid)
                continue;
            for (const variable of event.variables) {
                if (!athleteMap.has(variable.playerId))
                    continue;
                const athlete = athleteMap.get(variable.playerId);
                const dayKey = eventDate.toJSDate();
                let athleteGroup = dayGroups.get(athlete.id.toString());
                if (!athleteGroup) {
                    athleteGroup = new Map();
                    dayGroups.set(athlete.id.toString(), athleteGroup);
                }
                let dayEvents = athleteGroup.get(dayKey);
                if (!dayEvents) {
                    dayEvents = [];
                    athleteGroup.set(dayKey, dayEvents);
                }
                dayEvents.push({ variables: [variable], event });
            }
        }
        return { dayGroups, durationMap };
    }
    async processDay(athleteId, dayGroups, athletesById, durationMap, updatesByTable, valueTransformers) {
        const athlete = athletesById.get(athleteId);
        for (const [dayKey, dayEvents] of dayGroups.entries()) {
            const formattedDate = DateTime.fromJSDate(dayKey);
            const day = await this.athleteService.getOrCreateDay(athleteId, formattedDate);
            for (const { variables, event } of dayEvents) {
                const startDateTime = DateTime.fromISO(event.startDate);
                const endDateTime = DateTime.fromISO(event.endDate);
                const duration = day.id in durationMap
                    ? durationMap[day.id]
                    : endDateTime.diff(startDateTime, 'milliseconds').milliseconds;
                const timeOfActivity = startDateTime.toFormat('HH:mm:ss.000000');
                for (const variable of variables) {
                    const tableInfo = VARIABLE_ID_TO_TABLE[variable.variableCategoryId];
                    if (!tableInfo)
                        continue;
                    const { table, fieldName } = tableInfo;
                    let transformedValue = variable.value;
                    const transformer = valueTransformers[variable.variableCategoryId];
                    if (transformer) {
                        transformedValue = transformer(variable.value);
                    }
                    if (variable.variableCategoryId === '4d79bded-55a6-4cbe-aecc-fc8304b84223') {
                        durationMap[day.id] = transformedValue;
                    }
                    const updateData = {
                        day_id: day.id,
                        data_source: 'my_coach',
                        ...(table === 'sportactivity_sportactivity' && {
                            time_of_activity: timeOfActivity,
                            duration,
                            event_type: event.eventType,
                            game_activity: event.eventType === 'game' ? 1 : 0,
                            activity_type_id: 27,
                        }),
                        [fieldName]: transformedValue,
                    };
                    if (table === 'sportactivity_sportactivity') {
                        const query = SportActivity.query()
                            .where('dayId', day.id)
                            .where('timeOfActivity', updateData.time_of_activity || '');
                        if (updateData.activity_type_id !== undefined && updateData.activity_type_id !== null) {
                            query.where('activityTypeId', updateData.activity_type_id);
                        }
                        else {
                            query.whereNull('activityTypeId');
                        }
                        const existingActivity = await query.first();
                        if (GPS_PERIOD_METRICS.includes(fieldName)) {
                            const { [fieldName]: _, ...cleanUpdateData } = updateData;
                            const activityForMetric = existingActivity ||
                                (await SportActivity.create(toSportActivityCreatePayload(cleanUpdateData)));
                            let period = await Period.query()
                                .where('sportActivityId', activityForMetric.id)
                                .first();
                            if (!period) {
                                period = await Period.create({
                                    sportActivityId: activityForMetric.id,
                                    name: 'MyCoach Activity',
                                    startTime: startDateTime,
                                    endTime: endDateTime,
                                });
                            }
                            let metricValue = transformedValue;
                            if (fieldName === 'nb_efforts_above_25_kmh' && existingActivity) {
                                const periodWithMetrics = await Period.query()
                                    .where('id', period.id)
                                    .preload('metricValues', (query) => query.preload('metric'))
                                    .first();
                                const { nb_efforts_above_25_kmh: existingValue } = periodWithMetrics
                                    ? this.periodMetricService.extractNumericMetricsAsObject(periodWithMetrics, [
                                        'nb_efforts_above_25_kmh',
                                    ])
                                    : { nb_efforts_above_25_kmh: null };
                                if (existingValue !== null) {
                                    metricValue = transformedValue + existingValue;
                                }
                            }
                            await this.periodMetricService.updateMetrics(period.id, {
                                [fieldName]: metricValue,
                            });
                        }
                        else if (existingActivity) {
                            updatesByTable[table].push({ id: existingActivity.id, ...updateData });
                        }
                        else {
                            try {
                                await SportActivity.create(toSportActivityCreatePayload(updateData));
                            }
                            catch (error) {
                                console.error('Error creating activity:', error);
                                throw error;
                            }
                        }
                    }
                    else if (table === 'sleeps' || table === 'health_rating') {
                        const existingRecord = await (table === 'sleeps' ? Sleep : HealthRating)
                            .query()
                            .where('dayId', day.id)
                            .first();
                        if (existingRecord) {
                            const recordData = table === 'sleeps'
                                ? updateData
                                : (() => {
                                    const { data_source, ...healthData } = updateData;
                                    return healthData;
                                })();
                            updatesByTable[table].push({ id: existingRecord.id, ...recordData });
                        }
                        else {
                            try {
                                const recordData = table === 'sleeps'
                                    ? updateData
                                    : (() => {
                                        const { data_source, ...healthData } = updateData;
                                        return healthData;
                                    })();
                                await (table === 'sleeps' ? Sleep : HealthRating).create({
                                    ...recordData,
                                });
                            }
                            catch (error) {
                                console.error(`Error creating ${table} record:`, error);
                                throw error;
                            }
                        }
                    }
                    else if (table === 'health_painhealth') {
                        let health = await HealthRating.query().where('dayId', day.id).first();
                        if (!health) {
                            health = await HealthRating.create({
                                dayId: day.id,
                            });
                        }
                        try {
                            await HealthPain.create({
                                rating: transformedValue,
                                healthId: health.id,
                                updatedAt: DateTime.now(),
                            });
                        }
                        catch (error) {
                            console.error('Error creating health pain record:', error);
                            throw error;
                        }
                    }
                    else if (table === 'base_athlete' &&
                        (fieldName === 'weight' || fieldName === 'fat_percentage')) {
                        let bodymetrics = await BodymetricsHistory.query()
                            .where('athleteId', athlete.id)
                            .where('dayId', day.id)
                            .first();
                        if (!bodymetrics) {
                            bodymetrics = new BodymetricsHistory();
                            bodymetrics.athleteId = athlete.id;
                            bodymetrics.dayId = day.id;
                        }
                        if (fieldName === 'weight') {
                            bodymetrics.weight = variable.value;
                            athlete.weightKg = variable.value;
                        }
                        else if (fieldName === 'fat_percentage') {
                            bodymetrics.fatPercentage = variable.value;
                            athlete.fatPercentage = variable.value;
                        }
                        await bodymetrics.save();
                        await athlete.save();
                        continue;
                    }
                }
            }
        }
    }
    async performBulkUpdates(updatesByTable) {
        for (const [table, updates] of Object.entries(updatesByTable)) {
            if (updates.length === 0)
                continue;
            const toUpdate = updates.filter((u) => u.id);
            if (toUpdate.length > 0) {
                try {
                    const result = await Promise.allSettled(toUpdate.map((update) => {
                        const { id, ...data } = update;
                        return (table === 'sportactivity_sportactivity'
                            ? SportActivity
                            : table === 'sleeps'
                                ? Sleep
                                : table === 'health_health'
                                    ? HealthRating
                                    : Athlete)
                            .query()
                            .where('id', id)
                            .update(data);
                    }));
                    result.forEach((r, index) => {
                        if (r.status === 'rejected') {
                            console.error(`Failed to update ${table} record ${toUpdate[index].id}:`, r.reason);
                        }
                    });
                    const failedCount = result.filter((r) => r.status === 'rejected').length;
                    if (failedCount > 0) {
                        console.error(`Failed to update ${failedCount} ${table} records`);
                    }
                }
                catch (error) {
                    console.error(`Error updating records for ${table}:`, error);
                }
            }
        }
        console.log('\nProcessing complete!');
    }
    async processMyCoachData(data, playerId) {
        console.log('Starting MyCoach data processing...');
        const athletesQuery = Athlete.query()
            .whereHas('athleteProviders', (providerQuery) => {
            providerQuery
                .where('provider', ATHLETE_PROVIDER_TYPES.MY_COACH)
                .whereNotNull('providerAthleteId');
            if (playerId) {
                providerQuery.where('providerAthleteId', playerId);
            }
        })
            .preload('athleteProviders', (providerQuery) => {
            providerQuery.where('provider', ATHLETE_PROVIDER_TYPES.MY_COACH);
        });
        const athletes = await athletesQuery;
        const athleteMap = new Map();
        for (const athlete of athletes) {
            for (const provider of athlete.athleteProviders) {
                if (provider.providerAthleteId) {
                    athleteMap.set(provider.providerAthleteId, athlete);
                }
            }
        }
        if (playerId && athleteMap.size === 0) {
            return [];
        }
        const clubProviders = await ClubProvider.query()
            .where('provider', CLUB_PROVIDER_TYPES.MY_COACH)
            .whereNotNull('providerTeamId');
        const clubExternalIds = clubProviders
            .map((provider) => provider.providerTeamId)
            .filter((clubId) => clubId !== null);
        const relevantTeams = data.teams.filter((team) => team.id && clubExternalIds.includes(team.id));
        const relevantTeamIds = relevantTeams.map((team) => team.id);
        const { dayGroups, durationMap } = await this.processInitialData(data, athleteMap, relevantTeamIds);
        const updatesByTable = {
            sportactivity_sportactivity: [],
            sleeps: [],
            health_health: [],
            base_athlete: [],
        };
        const valueTransformers = {
            '57ebd4de-48f8-4a5a-b814-97878722d7a2': (v) => {
                if (v === 4 || v === 5) {
                    return Math.round((v / 7) * 5) - 1;
                }
                return Math.round((v / 7) * 5);
            },
            '8f552903-8c84-40be-b3e3-b1eeca714565': (v) => Math.round((v / 7) * 5),
            '22487e35-e3e3-4435-ae8d-4c2ce72ff490': (v) => Math.round(((8 - v) / 7) * 5),
            'af8242a5-b696-44ad-8434-093b6a412005': (v) => 5 - Math.round((v / 7) * 5),
            '5911c64a-1532-11eb-adc1-0242ac120002': (v) => Math.round((v / 12) * 10) + 1,
            '4d79bded-55a6-4cbe-aecc-fc8304b84223': (v) => v * 60000000,
        };
        const athletesById = new Map();
        for (const athlete of athleteMap.values()) {
            athletesById.set(athlete.id.toString(), athlete);
        }
        await Promise.all(Array.from(dayGroups.entries()).map(async ([athleteId, dayGroups]) => {
            await this.processDay(athleteId, dayGroups, athletesById, durationMap, updatesByTable, valueTransformers);
        }));
        await this.performBulkUpdates(updatesByTable);
        return {
            teams: relevantTeams,
            events: data.events.filter((event) => relevantTeamIds.includes(event.teamId)),
        };
    }
}
//# sourceMappingURL=my_coach_service.js.map