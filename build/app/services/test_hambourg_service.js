import { FOOTBALL_ACTIVITY_TYPE_ID, FOOTBALL_SPORT_ID, HAMBOURG_CLUB_ID, HAMBOURG_DEFAULT_PASSWORD, HAMBOURG_EMAIL_DOMAIN, isHambourgApiImportRow, isHambourgImportRow, isStatsportsGameSession, PLAYER_LIST_FILE, SAPSPORTSONE_QUEST_PERSONS_FILE, STATS_SPORTS_FILE, STATS_SPORTS_SHEET, } from '#constants/hambourg.constants';
import { GENDER } from '#constants/athlete.constants';
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
import { STATSSPORTS_PERIOD_METRICS } from '#constants/statsports.constants';
import { MetricDomain } from '#contracts/metric';
import Athlete from '#models_pg/athlete';
import AthleteProvider from '#models_pg/athlete_provider';
import Club from '#models_pg/club';
import Period from '#models_pg/period';
import PeriodMetric from '#models_pg/period_metric';
import PlayerPosition from '#models_pg/player_position';
import SportActivity from '#models_pg/sport_activity';
import AthleteService from '#services/athlete_service';
import { splitApiRow, transformExcelRowToApiRow, } from '#services/hambourg/fbl_mapping';
import { parseQuestPersonsCsv } from '#services/hambourg/sap_persons';
import { MetricService } from '#services/metric_service';
import hash from '@adonisjs/core/services/hash';
import db from '@adonisjs/lucid/services/db';
import ExcelJS from 'exceljs';
import { DateTime } from 'luxon';
import { readFileSync } from 'node:fs';
const DEFAULT_PASSWORD = HAMBOURG_DEFAULT_PASSWORD;
const EMAIL_DOMAIN = HAMBOURG_EMAIL_DOMAIN;
function athleteCacheKey(firstName, lastName) {
    return `${firstName}|${lastName}`;
}
function dayCacheKey(athleteId, dateOfDay) {
    return `${athleteId}|${dateOfDay}`;
}
function sportActivityCacheKey(dayId, timeOfActivity) {
    return `${dayId}|${normalizeActivityTime(timeOfActivity) ?? '__missing_time__'}`;
}
function normalizeActivityTime(timeOfActivity) {
    if (timeOfActivity === null || timeOfActivity === undefined)
        return null;
    const time = String(timeOfActivity).trim();
    if (!time || time === '00:00:00' || time === '0:00:00' || time === '00:00') {
        return null;
    }
    return time;
}
function periodCacheKey(sportActivityId, providerId) {
    return `${sportActivityId}|${providerId}`;
}
function formatImportRowError(excelRow, excelRowNumber, message) {
    const firstName = String(excelRow['PLAYER FIRST NAME'] ?? '').trim();
    const lastName = String(excelRow['PLAYER LAST NAME'] ?? '').trim();
    const player = [firstName, lastName].filter(Boolean).join(' ') || null;
    const sessionDate = excelRow['SESSION DATE'] ? String(excelRow['SESSION DATE']).trim() : null;
    const drill = excelRow['DRILL TITLE'] ? String(excelRow['DRILL TITLE']).trim() : null;
    return {
        excelRow: excelRowNumber,
        player,
        sessionDate,
        drill,
        message,
    };
}
function formatApiImportRowError(row, rowNumber, message) {
    const firstName = String(row.player_firstName ?? '').trim();
    const lastName = String(row.player_lastName ?? '').trim();
    const player = [firstName, lastName].filter(Boolean).join(' ') || null;
    const sessionDate = row.session_date ? String(row.session_date).trim() : null;
    const drill = row.drill_name ? String(row.drill_name).trim() : null;
    return {
        excelRow: rowNumber,
        player,
        sessionDate,
        drill,
        message,
    };
}
function formatImportRowErrorLine(error) {
    const parts = [`Row ${error.excelRow}`];
    if (error.player)
        parts.push(error.player);
    if (error.sessionDate)
        parts.push(error.sessionDate);
    if (error.drill)
        parts.push(`drill="${error.drill}"`);
    parts.push(error.message);
    return parts.join(' | ');
}
function formatCellValue(value) {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Date)
        return value.toISOString().slice(0, 10);
    if (typeof value === 'object' && 'result' in value)
        return value.result ?? null;
    if (typeof value === 'object' && 'text' in value)
        return value.text;
    return value;
}
function rowToRecord(headers, values) {
    return Object.fromEntries(headers.map((header, index) => [header, formatCellValue(values[index])]));
}
function slugifyEmailPart(value) {
    return value
        .trim()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '');
}
function buildEmail(firstName, lastName) {
    return `${slugifyEmailPart(firstName)}.${slugifyEmailPart(lastName)}@${EMAIL_DOMAIN}`;
}
function combineDateAndTime(dateIso, time) {
    const dateStr = String(dateIso);
    if (time === null || time === undefined || time === '') {
        return null;
    }
    const timeStr = String(time).trim();
    if (!timeStr || timeStr === '00:00:00') {
        return null;
    }
    const parsed = DateTime.fromISO(`${dateStr}T${timeStr}`, { zone: 'utc' });
    return parsed.isValid ? parsed : null;
}
function resolvePeriodTimes(sessionDateIso, drillStartTime, drillEndTime, totalTimeSeconds) {
    let startTime = combineDateAndTime(sessionDateIso, drillStartTime);
    let endTime = combineDateAndTime(sessionDateIso, drillEndTime);
    if (startTime && endTime && endTime <= startTime) {
        if (totalTimeSeconds && totalTimeSeconds > 0) {
            endTime = startTime.plus({ seconds: totalTimeSeconds });
        }
        else {
            startTime = null;
            endTime = null;
        }
    }
    if (startTime && !endTime && totalTimeSeconds && totalTimeSeconds > 0) {
        endTime = startTime.plus({ seconds: totalTimeSeconds });
    }
    if (!startTime && endTime && totalTimeSeconds && totalTimeSeconds > 0) {
        startTime = endTime.minus({ seconds: totalTimeSeconds });
    }
    if (startTime && endTime && endTime <= startTime) {
        return { startTime: null, endTime: null };
    }
    return { startTime, endTime };
}
function buildPeriodProviderId(context, periodMetrics) {
    return [
        context.player_firstName,
        context.player_lastName,
        context.session_date,
        context.drill_name,
        context.drill_start_time,
        periodMetrics.kpi_totalTime,
    ]
        .map((value) => (value === null || value === undefined ? '' : String(value).trim()))
        .join('|');
}
function compactPeriodMetrics(periodMetrics) {
    return Object.fromEntries(Object.entries(periodMetrics).filter((entry) => entry[1] !== null));
}
function computeSessionDurationSeconds(context) {
    const sessionDate = context.session_date;
    if (!sessionDate)
        return { durationSeconds: null, invalidDuration: false };
    const start = combineDateAndTime(sessionDate, context.session_start_time);
    const end = combineDateAndTime(sessionDate, context.session_end_time);
    if (!start || !end)
        return { durationSeconds: null, invalidDuration: false };
    const durationSeconds = Math.round(end.diff(start, 'seconds').seconds);
    if (durationSeconds < 0) {
        return { durationSeconds: null, invalidDuration: true };
    }
    return { durationSeconds, invalidDuration: false };
}
function parsePlayerList() {
    const content = readFileSync(PLAYER_LIST_FILE, 'utf-8').replace(/^\uFEFF/, '');
    const lines = content.trim().split(/\r?\n/).slice(1);
    return lines.map((line) => {
        const [personId, firstName, lastName, position] = line.split(',');
        return {
            personId: personId.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            position: position.trim(),
        };
    });
}
export class TestHambourgService {
    athleteService;
    periodMetricService;
    constructor() {
        this.athleteService = new AthleteService();
        this.periodMetricService = new MetricService(MetricDomain.PERIOD);
    }
    async createSportActivityFromExcelRow(excelRow, importContext) {
        return this.createSportActivityFromApiRow(transformExcelRowToApiRow(excelRow), importContext);
    }
    async createSportActivityFromApiRow(row, importContext) {
        const { context: rowContext, periodMetrics } = splitApiRow(row);
        const firstName = String(rowContext.player_firstName ?? '').trim();
        const lastName = String(rowContext.player_lastName ?? '').trim();
        const sessionDate = rowContext.session_date;
        if (!firstName || !lastName || !sessionDate) {
            throw new Error('Missing player_firstName, player_lastName or session_date in Excel row');
        }
        const sessionDateIso = String(sessionDate);
        const sessionStartTime = rowContext.session_start_time
            ? String(rowContext.session_start_time)
            : rowContext.drill_start_time
                ? String(rowContext.drill_start_time)
                : null;
        const missingTimes = !sessionStartTime;
        const sessionPlayerId = rowContext.session_player_id
            ? String(rowContext.session_player_id)
            : null;
        let athlete = null;
        if (sessionPlayerId) {
            athlete = importContext?.providerCache.get(sessionPlayerId) ?? null;
            if (!athlete) {
                const provider = await AthleteProvider.query()
                    .where('provider', ATHLETE_PROVIDER_TYPES.STATSPORTS)
                    .where('providerAthleteId', sessionPlayerId)
                    .preload('athlete')
                    .first();
                athlete = provider?.athlete ?? null;
                if (athlete) {
                    importContext?.providerCache.set(sessionPlayerId, athlete);
                }
            }
        }
        if (!athlete) {
            const nameKey = athleteCacheKey(firstName, lastName);
            athlete = importContext?.athleteCache.get(nameKey) ?? null;
            if (!athlete) {
                athlete = await Athlete.query()
                    .where('clubId', HAMBOURG_CLUB_ID)
                    .whereILike('firstName', firstName)
                    .whereILike('lastName', lastName)
                    .first();
                if (athlete) {
                    importContext?.athleteCache.set(nameKey, athlete);
                }
            }
        }
        if (!athlete) {
            const idHint = sessionPlayerId ? ` (id=${sessionPlayerId})` : '';
            throw new Error(`No athlete found for ${firstName} ${lastName}${idHint}`);
        }
        const activityDate = DateTime.fromISO(sessionDateIso, { zone: 'utc' });
        const dateOfDay = activityDate.toFormat('yyyy-MM-dd');
        const { startTime: drillStart, endTime: drillEnd } = resolvePeriodTimes(sessionDateIso, rowContext.drill_start_time, rowContext.drill_end_time, periodMetrics.kpi_totalTime);
        const providerId = buildPeriodProviderId(rowContext, periodMetrics);
        const metrics = compactPeriodMetrics(periodMetrics);
        const { durationSeconds, invalidDuration } = computeSessionDurationSeconds(rowContext);
        const periodNeedsReview = missingTimes || !drillStart || !drillEnd;
        const activityNeedsReview = missingTimes || invalidDuration;
        const dayCacheKeyValue = dayCacheKey(athlete.id, dateOfDay);
        let resolvedSportActivityCacheKey = sportActivityCacheKey('', sessionStartTime);
        let periodCacheKeyValue = null;
        const trx = await db.transaction();
        try {
            let day = importContext?.dayCache.get(dayCacheKeyValue);
            if (!day) {
                day = await this.athleteService.getOrCreateDay(athlete.id, activityDate, trx);
                importContext?.dayCache.set(dayCacheKeyValue, day);
            }
            const isGameSession = isStatsportsGameSession(rowContext.session_type);
            const normalizedSessionStart = normalizeActivityTime(sessionStartTime);
            resolvedSportActivityCacheKey = isGameSession
                ? `${day.id}|__game__`
                : sportActivityCacheKey(day.id, sessionStartTime);
            let sportActivity = importContext?.sportActivityCache.get(resolvedSportActivityCacheKey);
            let createdSportActivity = false;
            if (!sportActivity) {
                let existingSportActivity = null;
                if (normalizedSessionStart) {
                    existingSportActivity = await SportActivity.query({ client: trx })
                        .where('dayId', day.id)
                        .where('dataSource', 'statsports')
                        .where('timeOfActivity', normalizedSessionStart)
                        .first();
                }
                if (!existingSportActivity && (normalizedSessionStart === null || isGameSession)) {
                    const fallbackQuery = SportActivity.query({ client: trx })
                        .where('dayId', day.id)
                        .where('dataSource', 'statsports')
                        .orderByRaw(`CASE
                WHEN game_activity IS TRUE THEN 0
                ELSE 1
              END`)
                        .orderByRaw(`CASE
                WHEN time_of_activity IS NULL OR time_of_activity IN ('00:00:00', '0:00:00', '00:00')
                  THEN 1
                ELSE 0
              END`)
                        .orderBy('createdAt', 'asc');
                    if (isGameSession) {
                        fallbackQuery.where('gameActivity', true);
                    }
                    existingSportActivity = await fallbackQuery.first();
                    if (!isGameSession && existingSportActivity && normalizedSessionStart) {
                        const existingTime = normalizeActivityTime(existingSportActivity.timeOfActivity);
                        if (existingTime && existingTime !== normalizedSessionStart) {
                            existingSportActivity = null;
                        }
                    }
                }
                if (existingSportActivity) {
                    sportActivity = existingSportActivity;
                    let dirty = false;
                    if (activityNeedsReview && !sportActivity.needsReview) {
                        sportActivity.needsReview = true;
                        dirty = true;
                    }
                    if (isGameSession && sportActivity.gameActivity !== true) {
                        sportActivity.gameActivity = true;
                        dirty = true;
                    }
                    if (normalizedSessionStart &&
                        normalizeActivityTime(sportActivity.timeOfActivity) === null) {
                        sportActivity.timeOfActivity = normalizedSessionStart;
                        dirty = true;
                    }
                    if (dirty) {
                        await sportActivity.useTransaction(trx).save();
                    }
                }
                else {
                    sportActivity = await SportActivity.create({
                        dayId: day.id,
                        activityTypeId: FOOTBALL_ACTIVITY_TYPE_ID,
                        dataSource: 'statsports',
                        activityName: rowContext.session_type ? String(rowContext.session_type).trim() : null,
                        timeOfActivity: normalizedSessionStart,
                        durationSeconds,
                        gameActivity: isGameSession,
                        needsReview: activityNeedsReview,
                    }, { client: trx });
                    createdSportActivity = true;
                }
                importContext?.sportActivityCache.set(resolvedSportActivityCacheKey, sportActivity);
            }
            periodCacheKeyValue = periodCacheKey(sportActivity.id, providerId);
            let period = importContext?.periodCache.get(periodCacheKeyValue);
            let createdPeriod = false;
            if (!period) {
                const existingPeriod = await Period.query({ client: trx })
                    .where('sportActivityId', sportActivity.id)
                    .where('providerId', providerId)
                    .first();
                if (existingPeriod) {
                    period = existingPeriod;
                    if (periodNeedsReview && !period.needsReview) {
                        period.needsReview = true;
                        await period.useTransaction(trx).save();
                    }
                }
                else {
                    period = await Period.create({
                        sportActivityId: sportActivity.id,
                        providerId,
                        name: rowContext.drill_name ? String(rowContext.drill_name).trim() : null,
                        startTime: drillStart,
                        endTime: drillEnd,
                        needsReview: periodNeedsReview,
                    }, { client: trx });
                    createdPeriod = true;
                }
                importContext?.periodCache.set(periodCacheKeyValue, period);
            }
            if (Object.keys(metrics).length > 0) {
                await this.periodMetricService.storeEntityMetrics(period.id, metrics, trx, {
                    metricsCatalog: importContext?.metricsCatalog,
                });
            }
            await trx.commit();
            return {
                sportActivity,
                period,
                created: {
                    sportActivity: createdSportActivity,
                    period: createdPeriod,
                },
            };
        }
        catch (error) {
            await trx.rollback();
            importContext?.dayCache.delete(dayCacheKeyValue);
            importContext?.sportActivityCache.delete(resolvedSportActivityCacheKey);
            if (periodCacheKeyValue) {
                importContext?.periodCache.delete(periodCacheKeyValue);
            }
            throw error;
        }
    }
    async createImportContext() {
        const [athletes, periodMetrics, providers] = await Promise.all([
            Athlete.query().where('clubId', HAMBOURG_CLUB_ID),
            PeriodMetric.query().whereIn('name', [...STATSSPORTS_PERIOD_METRICS]),
            AthleteProvider.query()
                .where('provider', ATHLETE_PROVIDER_TYPES.STATSPORTS)
                .whereNotNull('providerAthleteId')
                .preload('athlete'),
        ]);
        const athleteCache = new Map(athletes.map((a) => [athleteCacheKey(a.firstName, a.lastName), a]));
        const providerCache = new Map(providers
            .filter((p) => p.providerAthleteId && p.athlete)
            .map((p) => [p.providerAthleteId, p.athlete]));
        return {
            athleteCache,
            providerCache,
            dayCache: new Map(),
            sportActivityCache: new Map(),
            periodCache: new Map(),
            metricsCatalog: new Map(periodMetrics.map((metric) => [metric.name, { id: metric.id, dataType: metric.dataType }])),
        };
    }
    async importRowsInBatches(options) {
        const { limit, offset = 0, batchSize = 50, onBatchComplete, onWarmup } = options;
        const startedAt = Date.now();
        const errors = [];
        const importContext = await this.createImportContext();
        onWarmup?.({
            athletes: importContext.athleteCache.size,
            metrics: importContext.metricsCatalog.size,
        });
        let dataRowIndex = 0;
        let fblRowsSeen = 0;
        let rowsProcessed = 0;
        let imported = 0;
        let failed = 0;
        let skippedFilter = 0;
        let createdActivities = 0;
        let createdPeriods = 0;
        let batchImported = 0;
        let batchFailed = 0;
        let batchCreatedActivities = 0;
        let batchCreatedPeriods = 0;
        let batchNumber = 0;
        const batchErrors = [];
        const totalBatches = Math.max(1, Math.ceil(limit / batchSize));
        const flushBatch = () => {
            if (batchImported === 0 && batchFailed === 0)
                return;
            batchNumber++;
            const elapsedMs = Date.now() - startedAt;
            const rowsPerSecond = rowsProcessed > 0 ? rowsProcessed / (elapsedMs / 1000) : 0;
            onBatchComplete?.({
                batchNumber,
                totalBatches,
                batchFrom: rowsProcessed - batchImported - batchFailed + 1,
                batchTo: rowsProcessed,
                rowsProcessed,
                limit,
                imported,
                failed,
                createdActivities,
                createdPeriods,
                batchImported,
                batchFailed,
                batchCreatedActivities,
                batchCreatedPeriods,
                elapsedMs,
                rowsPerSecond,
                batchErrors: batchErrors.map(formatImportRowErrorLine),
            });
            batchImported = 0;
            batchFailed = 0;
            batchCreatedActivities = 0;
            batchCreatedPeriods = 0;
            batchErrors.length = 0;
        };
        for await (const excelRow of this.streamExcelRows()) {
            dataRowIndex++;
            if (!isHambourgImportRow(excelRow)) {
                skippedFilter++;
                continue;
            }
            if (fblRowsSeen < offset) {
                fblRowsSeen++;
                continue;
            }
            if (rowsProcessed >= limit)
                break;
            try {
                const result = await this.createSportActivityFromExcelRow(excelRow, importContext);
                imported++;
                batchImported++;
                if (result.created.sportActivity) {
                    createdActivities++;
                    batchCreatedActivities++;
                }
                if (result.created.period) {
                    createdPeriods++;
                    batchCreatedPeriods++;
                }
            }
            catch (error) {
                failed++;
                batchFailed++;
                const message = error instanceof Error ? error.message : String(error);
                const rowError = formatImportRowError(excelRow, dataRowIndex, message);
                errors.push(rowError);
                batchErrors.push(rowError);
            }
            rowsProcessed++;
            fblRowsSeen++;
            if (rowsProcessed % batchSize === 0) {
                flushBatch();
            }
        }
        flushBatch();
        return {
            rowsProcessed,
            imported,
            failed,
            skippedFilter,
            createdActivities,
            createdPeriods,
            errors,
            elapsedMs: Date.now() - startedAt,
        };
    }
    async importApiRowsInBatches(options) {
        const { rows, limit = 0, offset = 0, batchSize = 50, onBatchComplete, onWarmup } = options;
        const importLimit = limit > 0 ? limit : rows.length;
        const startedAt = Date.now();
        const errors = [];
        const importContext = await this.createImportContext();
        onWarmup?.({
            athletes: importContext.athleteCache.size,
            metrics: importContext.metricsCatalog.size,
        });
        let rowsSeen = 0;
        let rowsProcessed = 0;
        let imported = 0;
        let failed = 0;
        let skippedFilter = 0;
        let createdActivities = 0;
        let createdPeriods = 0;
        let batchImported = 0;
        let batchFailed = 0;
        let batchCreatedActivities = 0;
        let batchCreatedPeriods = 0;
        let batchNumber = 0;
        const batchErrors = [];
        const totalBatches = Math.max(1, Math.ceil(importLimit / batchSize));
        const flushBatch = () => {
            if (batchImported === 0 && batchFailed === 0)
                return;
            batchNumber++;
            const elapsedMs = Date.now() - startedAt;
            const rowsPerSecond = rowsProcessed > 0 ? rowsProcessed / (elapsedMs / 1000) : 0;
            onBatchComplete?.({
                batchNumber,
                totalBatches,
                batchFrom: rowsProcessed - batchImported - batchFailed + 1,
                batchTo: rowsProcessed,
                rowsProcessed,
                limit: importLimit,
                imported,
                failed,
                createdActivities,
                createdPeriods,
                batchImported,
                batchFailed,
                batchCreatedActivities,
                batchCreatedPeriods,
                elapsedMs,
                rowsPerSecond,
                batchErrors: batchErrors.map(formatImportRowErrorLine),
            });
            batchImported = 0;
            batchFailed = 0;
            batchCreatedActivities = 0;
            batchCreatedPeriods = 0;
            batchErrors.length = 0;
        };
        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const rowNumber = index + 1;
            if (!isHambourgApiImportRow(row)) {
                skippedFilter++;
                continue;
            }
            if (rowsSeen < offset) {
                rowsSeen++;
                continue;
            }
            if (rowsProcessed >= importLimit)
                break;
            try {
                const result = await this.createSportActivityFromApiRow(row, importContext);
                imported++;
                batchImported++;
                if (result.created.sportActivity) {
                    createdActivities++;
                    batchCreatedActivities++;
                }
                if (result.created.period) {
                    createdPeriods++;
                    batchCreatedPeriods++;
                }
            }
            catch (error) {
                failed++;
                batchFailed++;
                const message = error instanceof Error ? error.message : String(error);
                const rowError = formatApiImportRowError(row, rowNumber, message);
                errors.push(rowError);
                batchErrors.push(rowError);
            }
            rowsProcessed++;
            rowsSeen++;
            if (rowsProcessed % batchSize === 0) {
                flushBatch();
            }
        }
        flushBatch();
        return {
            rowsProcessed,
            imported,
            failed,
            skippedFilter,
            createdActivities,
            createdPeriods,
            errors,
            elapsedMs: Date.now() - startedAt,
        };
    }
    async *streamExcelRows(options) {
        const applyTeamFilter = options?.teamFilter ?? false;
        const reader = new ExcelJS.stream.xlsx.WorkbookReader(STATS_SPORTS_FILE, {
            worksheets: 'emit',
            sharedStrings: 'cache',
            hyperlinks: 'ignore',
            styles: 'ignore',
        });
        for await (const worksheet of reader) {
            const worksheetName = worksheet.name;
            if (worksheetName !== STATS_SPORTS_SHEET)
                continue;
            let headers = [];
            for await (const row of worksheet) {
                const values = row.values.slice(1);
                if (row.number === 1) {
                    headers = values.map((value) => String(formatCellValue(value) ?? ''));
                    continue;
                }
                const record = rowToRecord(headers, values);
                if (applyTeamFilter && !isHambourgImportRow(record))
                    continue;
                yield record;
            }
            return;
        }
        throw new Error(`Sheet not found: "${STATS_SPORTS_SHEET}" in ${STATS_SPORTS_FILE}. Check STATS_SPORTS_SHEET in hambourg.constants.ts`);
    }
    async readExcelHeaders() {
        const reader = new ExcelJS.stream.xlsx.WorkbookReader(STATS_SPORTS_FILE, {
            worksheets: 'emit',
            sharedStrings: 'cache',
            hyperlinks: 'ignore',
            styles: 'ignore',
        });
        for await (const worksheet of reader) {
            const worksheetName = worksheet.name;
            if (worksheetName !== STATS_SPORTS_SHEET)
                continue;
            for await (const row of worksheet) {
                const values = row.values.slice(1);
                return values.map((value) => String(formatCellValue(value) ?? ''));
            }
        }
        throw new Error(`Sheet not found: "${STATS_SPORTS_SHEET}" in ${STATS_SPORTS_FILE}. Check STATS_SPORTS_SHEET in hambourg.constants.ts`);
    }
    async collectExcelRows(limit, teamFilter = false) {
        const rows = [];
        for await (const row of this.streamExcelRows({ teamFilter })) {
            rows.push(row);
            if (rows.length >= limit)
                break;
        }
        return rows;
    }
    async previewRows(limit = 10) {
        const [columns, rows] = await Promise.all([
            this.readExcelHeaders(),
            this.collectExcelRows(limit, true),
        ]);
        return { columns, rows };
    }
    async importPlayers() {
        await Club.findOrFail(HAMBOURG_CLUB_ID);
        const players = parsePlayerList();
        const persons = parseQuestPersonsCsv(SAPSPORTSONE_QUEST_PERSONS_FILE);
        const hashedPassword = await hash.make(DEFAULT_PASSWORD);
        const warnings = [];
        const positionCache = new Map();
        let created = 0;
        let skipped = 0;
        for (const player of players) {
            const email = buildEmail(player.firstName, player.lastName);
            const existing = await Athlete.findBy('email', email);
            const person = persons.get(player.personId.toUpperCase());
            if (existing) {
                await AthleteProvider.firstOrCreate({
                    athleteId: existing.id,
                    provider: ATHLETE_PROVIDER_TYPES.SAP,
                    providerAthleteId: player.personId,
                }, {});
                warnings.push(`Skipped ${player.firstName} ${player.lastName}: email already exists (${email})`);
                skipped++;
                continue;
            }
            const position = await this.resolvePosition(player.position, positionCache, warnings);
            const athlete = await Athlete.create({
                firstName: player.firstName,
                lastName: player.lastName,
                email,
                password: hashedPassword,
                birthDate: person?.birthday ?? DateTime.fromISO('2000-01-01'),
                startDate: DateTime.fromISO('2026-07-01'),
                heightCm: 170,
                weightKg: 70,
                appLanguage: 'en',
                clubId: HAMBOURG_CLUB_ID,
                playerPositionId: position.id,
                gender: person?.gender ?? GENDER.MALE,
            });
            await AthleteProvider.create({
                athleteId: athlete.id,
                provider: ATHLETE_PROVIDER_TYPES.SAP,
                providerAthleteId: player.personId,
            });
            created++;
        }
        return { created, skipped, warnings };
    }
    async resolvePosition(rawName, cache, warnings) {
        const name = rawName.trim().toUpperCase();
        const cached = cache.get(name);
        if (cached)
            return cached;
        let position = await PlayerPosition.query()
            .where('sportId', FOOTBALL_SPORT_ID)
            .whereILike('name', name)
            .first();
        if (!position) {
            position = await PlayerPosition.create({
                name,
                sportId: FOOTBALL_SPORT_ID,
            });
            warnings.push(`Created position: ${name}`);
        }
        cache.set(name, position);
        return position;
    }
}
//# sourceMappingURL=test_hambourg_service.js.map