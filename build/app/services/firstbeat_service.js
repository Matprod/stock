import env from '#start/env';
import logger from '@adonisjs/core/services/logger';
import jwt from 'jsonwebtoken';
import Athlete from '#models_pg/athlete';
import Activity from '#models_pg/activity';
import axios from 'axios';
import Club from '#models_pg/club';
import SportActivity from '#models_pg/sport_activity';
import Period from '#models_pg/period';
import Serie from '#models_pg/serie';
import { DateTime } from 'luxon';
import { SportActivityService } from './sport_activity_service.js';
import { EventService } from '#services/event_service';
import AthleteService from '#services/athlete_service';
import { RPE_REMINDER } from '#constants/notification_messages';
import { NotificationService } from '#services/notification_service';
import { SERIE_TYPE, DATA_TYPE, DEFAULT_HEART_RATE_SAMPLES_PER_MINUTE, } from '#constants/serie.constants';
import { decodeTimeseries, encodeJsonPayload } from '../utils/statistics.js';
import { FIRSTBEAT_PERIOD_METRIC_BINDINGS } from '#constants/sport_activity_period_metrics.constants';
import { MetricDomain } from '#contracts/metric';
import { MetricService } from '#services/metric_service';
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
export default class FirstbeatService {
    clientId = env.get('FIRSTBEAT_CLIENT_ID');
    clientSecret = env.get('FIRSTBEAT_CLIENT_SECRET');
    apiKey = env.get('FIRSTBEAT_API_KEY');
    accountId = env.get('FIRSTBEAT_ACCOUNT_ID');
    baseUrl = env.get('FIRSTBEAT_BASE_URL');
    sportActivityService;
    eventService;
    athleteService;
    notificationService;
    periodMetricService = new MetricService(MetricDomain.PERIOD);
    constructor() {
        this.sportActivityService = new SportActivityService();
        this.eventService = new EventService();
        this.athleteService = new AthleteService();
        this.notificationService = new NotificationService();
    }
    encodeSeriesAsJsonPayload(encodedSeries, startDate, sourceDataType, sourceBits, samplesPerMinute, valueKey, littleEndian = true) {
        const values = decodeTimeseries(encodedSeries, sourceDataType, sourceBits, littleEndian);
        if (values.length === 0)
            return null;
        const startTimestamp = Math.round(startDate.toSeconds());
        const secondsPerSample = 60 / samplesPerMinute;
        const shouldRound = sourceDataType !== DATA_TYPE.FLOAT;
        const payload = {
            points: values.map((value, index) => {
                const ts = Math.round(startTimestamp + index * secondsPerSample);
                const numericValue = shouldRound ? Math.round(value) : value;
                return {
                    ts,
                    [valueKey]: numericValue,
                };
            }),
        };
        return encodeJsonPayload(payload);
    }
    generateToken() {
        const issuedAt = Math.floor(Date.now() / 1000);
        const payload = {
            iss: this.clientId,
            iat: issuedAt,
            exp: issuedAt + 300,
        };
        const token = jwt.sign(payload, this.clientSecret);
        return token;
    }
    async getAthletesWithFirstbeatId() {
        return Athlete.query()
            .whereHas('athleteProviders', (query) => {
            query.where('provider', ATHLETE_PROVIDER_TYPES.FIRSTBEAT).whereNotNull('providerAthleteId');
        })
            .preload('athleteProviders', (query) => {
            query.where('provider', ATHLETE_PROVIDER_TYPES.FIRSTBEAT);
        });
    }
    async fetchMeasurementsForAthlete(firstbeatId, token, startDate, endDate) {
        const url = `${this.baseUrl}/sports/accounts/${this.accountId}/athletes/${firstbeatId}/measurements?includeLaps=true${startDate
            ? `&fromTime=${encodeURIComponent(startDate.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ"))}`
            : ''}${endDate ? `&toTime=${encodeURIComponent(endDate.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ"))}` : ''}`;
        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('Error fetching measurements:', error);
            return null;
        }
    }
    async fetchMeasurementResults(firstbeatId, measurementId, token) {
        const url = `${this.baseUrl}/sports/accounts/${this.accountId}/athletes/${firstbeatId}/measurements/${measurementId}/results`;
        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('Error fetching measurement results:', error);
            return null;
        }
    }
    async syncAthlete({ athlete, startDate, endDate, token }) {
        if (!token) {
            token = this.generateToken();
        }
        if (!athlete.athleteProviders?.length) {
            await athlete.load('athleteProviders', (query) => {
                query.where('provider', ATHLETE_PROVIDER_TYPES.FIRSTBEAT).whereNotNull('providerAthleteId');
            });
        }
        const firstbeatId = athlete.athleteProviders?.[0]?.providerAthleteId;
        if (!firstbeatId)
            return;
        const measurements = await this.fetchMeasurementsForAthlete(firstbeatId, token, startDate, endDate);
        if (!measurements || !measurements.measurements) {
            logger.info({ athleteId: athlete.id, firstbeatId }, 'Firstbeat sync: no measurements');
            return;
        }
        const measurementIds = measurements.measurements.map((measurement) => String(measurement.measurementId));
        const existingPeriods = measurementIds.length > 0
            ? await Period.query()
                .whereIn('providerId', measurementIds)
                .whereHas('sportActivity', (query) => {
                query.where('dataSource', 'firstbeat').whereHas('day', (dayQuery) => {
                    dayQuery.where('athleteId', athlete.id);
                });
            })
            : [];
        const existingMeasurementIds = new Set(existingPeriods.map((period) => period.providerId));
        const measurementsToProcess = measurements.measurements.filter((measurement) => !existingMeasurementIds.has(String(measurement.measurementId)));
        logger.info({
            athleteId: athlete.id,
            firstbeatId,
            fetched: measurements.measurements.length,
            alreadyProcessed: existingMeasurementIds.size,
            toDispatch: measurementsToProcess.length,
        }, 'Firstbeat sync');
        if (measurementsToProcess.length === 0)
            return;
        const { default: ProcessFirstbeatJob } = await import('#jobs/process_firstbeat_job');
        await Promise.all(measurementsToProcess.map(async (measurement) => {
            await ProcessFirstbeatJob.dispatch({
                athleteId: athlete.id,
                measurementId: measurement.measurementId,
            });
        }));
        if (athlete.fcmDeviceToken) {
            const isFrench = athlete.appLanguage === 'fr';
            const choices = isFrench ? RPE_REMINDER.fr : RPE_REMINDER.en;
            const msg = choices[Math.floor(Math.random() * choices.length)];
            try {
                await this.notificationService.sendToToken(athlete.fcmDeviceToken, msg.title, msg.body);
            }
            catch (error) {
                console.error('Failed to send RPE reminder notification:', error);
            }
        }
    }
    async processFirstbeatMeasurements({ athleteId, measurementId, }) {
        const athlete = await Athlete.query()
            .where('id', athleteId)
            .preload('athleteProviders', (query) => {
            query.where('provider', ATHLETE_PROVIDER_TYPES.FIRSTBEAT);
        })
            .first();
        const firstbeatId = athlete?.athleteProviders?.[0]?.providerAthleteId;
        if (!athlete || !firstbeatId)
            return;
        const results = await this.fetchMeasurementResults(firstbeatId, measurementId, this.generateToken());
        if (!results)
            return;
        const startDate = DateTime.fromISO(results.startTime);
        const endDate = DateTime.fromISO(results.endTime);
        const durationSeconds = Math.round(endDate.diff(startDate).as('seconds'));
        const club = await Club.query().where('id', athlete.clubId).preload('sport').first();
        const activityType = await Activity.query()
            .where('name', club?.sport?.name ?? 'Basketball')
            .first();
        if (!activityType)
            return;
        const day = await this.athleteService.getOrCreateDay(athlete.id, startDate);
        const getSeries = (name) => {
            const found = (results.variables || []).find((v) => v.name === name);
            return found && typeof found.value === 'string' ? found.value : null;
        };
        const getNumberValue = (name) => {
            const found = (results.variables || []).find((v) => v.name === name);
            return found && typeof found.value === 'number' ? found.value : null;
        };
        const toInteger = (value) => {
            if (value === null || !Number.isFinite(value))
                return null;
            return Math.round(value);
        };
        let activity = await this.findActivityToMerge({
            dayId: day.id,
            activityTypeId: activityType.id,
            measurementId,
        });
        const mergedExisting = !!activity;
        if (!activity) {
            activity = await SportActivity.create({
                dayId: day.id,
                timeOfActivity: startDate.toFormat('HH:mm:ss'),
                dataSource: 'firstbeat',
                activityTypeId: activityType.id,
                activityName: activityType.name,
                gameActivity: false,
            });
        }
        activity.activeCalories = toInteger(getNumberValue('energyConsumptionTotal'));
        activity.averagedBpm = toInteger(getNumberValue('heartRateAverage'));
        activity.fcMax = toInteger(getNumberValue('heartRatePeak'));
        activity.durationSeconds = toInteger(durationSeconds);
        activity.dataSource = 'firstbeat';
        if (!activity.activityTypeId) {
            activity.activityTypeId = activityType.id;
        }
        if (!activity.activityName) {
            activity.activityName = activityType.name;
        }
        if (!mergedExisting && activity.fcMax) {
            athlete.fcMax = activity.fcMax;
            await athlete.save();
        }
        await activity.save();
        const periodStartTime = startDate;
        const periodEndTime = endDate;
        let period = await Period.query()
            .where('sportActivityId', activity.id)
            .where('providerId', String(measurementId))
            .first();
        if (!period) {
            period = await Period.create({
                sportActivityId: activity.id,
                providerId: measurementId.toString(),
                name: 'Firstbeat Activity',
                startTime: periodStartTime,
                endTime: periodEndTime,
            });
        }
        else {
            period.startTime = periodStartTime;
            period.endTime = periodEndTime;
            await period.save();
        }
        await this.periodMetricService.updateMetrics(period.id, Object.fromEntries(FIRSTBEAT_PERIOD_METRIC_BINDINGS.map(([metricName, sourceKey]) => [
            metricName,
            getNumberValue(sourceKey),
        ])));
        const samplesPerMinute = DEFAULT_HEART_RATE_SAMPLES_PER_MINUTE;
        const seriesToCreate = [];
        const heartRateSeries = getSeries('heartRateSeries');
        const epocSeries = getSeries('epocSeries');
        const energyConsumptionSeries = getSeries('energyConsumptionSeries');
        const trimpSeries = getSeries('trimpSeries');
        const firstbeatSeriesToEncode = [
            {
                sourceSeries: heartRateSeries,
                type: SERIE_TYPE.HEART_RATE,
                valueKey: 'hr',
                sourceDataType: DATA_TYPE.UNSIGNED,
                sourceBits: 8,
                littleEndian: true,
            },
            {
                sourceSeries: epocSeries,
                type: SERIE_TYPE.EPOC_SERIES,
                valueKey: 'epoc',
                sourceDataType: DATA_TYPE.FLOAT,
                sourceBits: 64,
                littleEndian: false,
            },
            {
                sourceSeries: energyConsumptionSeries,
                type: SERIE_TYPE.ENERGY_CONSUMPTION_SERIES,
                valueKey: 'energy',
                sourceDataType: DATA_TYPE.UNSIGNED,
                sourceBits: 16,
                littleEndian: true,
            },
            {
                sourceSeries: trimpSeries,
                type: SERIE_TYPE.TRIMP_SERIES,
                valueKey: 'trimp',
                sourceDataType: DATA_TYPE.FLOAT,
                sourceBits: 64,
                littleEndian: false,
            },
        ];
        for (const seriesConfig of firstbeatSeriesToEncode) {
            if (!seriesConfig.sourceSeries)
                continue;
            const encodedSeries = this.encodeSeriesAsJsonPayload(seriesConfig.sourceSeries, startDate, seriesConfig.sourceDataType, seriesConfig.sourceBits, samplesPerMinute, seriesConfig.valueKey, seriesConfig.littleEndian);
            if (!encodedSeries)
                continue;
            seriesToCreate.push({
                periodId: period.id,
                type: seriesConfig.type,
                dataEncoded: encodedSeries,
                dataType: seriesConfig.sourceDataType,
            });
        }
        const existingSeries = await Serie.query().where('periodId', period.id);
        const existingSeriesByType = new Map();
        existingSeries.forEach((serie) => {
            existingSeriesByType.set(serie.type, serie);
        });
        for (const serieData of seriesToCreate) {
            const existing = existingSeriesByType.get(serieData.type);
            if (existing) {
                existing.dataEncoded = serieData.dataEncoded;
                existing.dataType = serieData.dataType;
                await existing.save();
                existingSeriesByType.delete(serieData.type);
            }
            else {
                await Serie.create(serieData);
            }
        }
        for (const serie of existingSeriesByType.values()) {
            await serie.delete();
        }
        await activity.save();
        await this.sportActivityService.calculateTrainingLoad(activity.id, true);
        if (!activity.eventId) {
            await this.eventService.syncSportActivityToCalendar(activity);
        }
    }
    async findActivityToMerge({ dayId, activityTypeId, measurementId, }) {
        const existingPeriod = await Period.query()
            .where('providerId', String(measurementId))
            .whereHas('sportActivity', (query) => {
            query.where('dayId', dayId);
        })
            .preload('sportActivity')
            .first();
        if (existingPeriod?.sportActivity) {
            return existingPeriod.sportActivity;
        }
        return SportActivity.query()
            .where('dayId', dayId)
            .where('dataSource', 'manual')
            .where('activityTypeId', activityTypeId)
            .orderBy('timeOfActivity', 'asc')
            .first();
    }
}
//# sourceMappingURL=firstbeat_service.js.map