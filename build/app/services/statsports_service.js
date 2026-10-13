import { STATSSPORTS_API_CONFIG } from '#constants/statsports.constants';
import { CLUB_PROVIDER_TYPES } from '#constants/club_provider.constants';
import ClubProvider from '#models_pg/club_provider';
import { StatssportsPersistService } from '#services/statsports_persist_service';
import { iterateChunks, mapBundleToRows, parseIsoDateTime, splitWindow, toIsoZ, } from '#utils/statsports';
import logger from '@adonisjs/core/services/logger';
import axios from 'axios';
import { DateTime } from 'luxon';
const RETRYABLE_STATUS = new Set([408, 429]);
const RETRYABLE_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET']);
const isRetryable = (error) => {
    if (!axios.isAxiosError(error))
        return false;
    const status = error.response?.status;
    if (status !== undefined && (RETRYABLE_STATUS.has(status) || status >= 500))
        return true;
    if (error.code && RETRYABLE_CODES.has(error.code))
        return true;
    return error.message.includes('socket hang up');
};
export class StatssportsService {
    clubId;
    thirdPartyApiId;
    client;
    constructor(config) {
        this.clubId = config.clubId;
        this.thirdPartyApiId = config.thirdPartyApiId;
        this.client = axios.create({
            baseURL: STATSSPORTS_API_CONFIG.baseUrl,
            timeout: STATSSPORTS_API_CONFIG.timeoutMs,
            maxRedirects: 0,
            headers: {
                'accept': 'application/json',
                'api-version': STATSSPORTS_API_CONFIG.apiVersion,
            },
        });
    }
    static fromClubProvider(provider) {
        if (!provider.accessToken) {
            throw new Error(`STATSports provider misconfigured for club ${provider.clubId}: accessToken (thirdPartyApiId) is required`);
        }
        return new StatssportsService({
            clubId: provider.clubId,
            thirdPartyApiId: provider.accessToken,
        });
    }
    static async fromClubId(clubId) {
        const provider = await ClubProvider.query()
            .where('clubId', clubId)
            .where('provider', CLUB_PROVIDER_TYPES.STATSPORTS)
            .firstOrFail();
        return StatssportsService.fromClubProvider(provider);
    }
    static async getConfiguredProviders() {
        return ClubProvider.query()
            .where('provider', CLUB_PROVIDER_TYPES.STATSPORTS)
            .whereNotNull('accessToken');
    }
    static async fetchAndQueueForAllClubs(startDate, endDate) {
        const providers = await StatssportsService.getConfiguredProviders();
        if (providers.length === 0)
            return [];
        const sessionStart = toIsoZ(startDate.toUTC());
        const sessionEnd = toIsoZ((endDate ?? DateTime.utc()).toUTC());
        const { default: ProcessStatssportsJob } = await import('#jobs/process_statsports_job');
        const results = [];
        for (const provider of providers) {
            try {
                await ProcessStatssportsJob.dispatch({
                    clubId: provider.clubId,
                    sessionStart,
                    sessionEnd,
                });
                results.push({ clubId: provider.clubId, queued: true });
            }
            catch (error) {
                results.push({
                    clubId: provider.clubId,
                    queued: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        return results;
    }
    async syncDateRange(range) {
        const persist = new StatssportsPersistService(this.clubId);
        const start = parseIsoDateTime(range.sessionStart);
        const end = parseIsoDateTime(range.sessionEnd);
        const chunkDays = range.chunkDays ?? STATSSPORTS_API_CONFIG.chunkDays;
        const totalChunks = [...iterateChunks(start, end, chunkDays)].length;
        const totals = {
            clubId: this.clubId,
            chunks: 0,
            bundles: 0,
            rows: 0,
            imported: 0,
            createdActivities: 0,
            createdPeriods: 0,
            createdEvents: 0,
            linkedEvents: 0,
            skippedNoPlayerId: 0,
            skippedNoAthlete: 0,
            failed: 0,
        };
        logger.info(`STATSports club ${this.clubId} starting ${toIsoZ(start)} → ${toIsoZ(end)} chunks=${totalChunks} chunkDays=${chunkDays}`);
        for await (const chunk of this.iterateMappedChunks(range)) {
            totals.chunks++;
            totals.bundles += chunk.bundles;
            logger.info(`STATSports club ${this.clubId} chunk ${totals.chunks}/${totalChunks} fetched ${chunk.start} → ${chunk.end} bundles=${chunk.bundles} rows=${chunk.rows.length}`);
            const persisted = await persist.persistRows(chunk.rows);
            totals.rows += persisted.rows;
            totals.imported += persisted.imported;
            totals.createdActivities += persisted.createdActivities;
            totals.createdPeriods += persisted.createdPeriods;
            totals.createdEvents += persisted.createdEvents;
            totals.linkedEvents += persisted.linkedEvents;
            totals.skippedNoPlayerId += persisted.skippedNoPlayerId;
            totals.skippedNoAthlete += persisted.skippedNoAthlete;
            totals.failed += persisted.failed;
            logger.info(`STATSports club ${this.clubId} chunk ${totals.chunks}/${totalChunks} persisted imported=${persisted.imported} activities=${persisted.createdActivities} periods=${persisted.createdPeriods} eventsCreated=${persisted.createdEvents} eventsLinked=${persisted.linkedEvents} skippedNoPlayerId=${persisted.skippedNoPlayerId} skippedNoAthlete=${persisted.skippedNoAthlete} failed=${persisted.failed}`);
        }
        const provider = await ClubProvider.query()
            .where('clubId', this.clubId)
            .where('provider', CLUB_PROVIDER_TYPES.STATSPORTS)
            .first();
        if (provider) {
            provider.lastSyncedAt = DateTime.now();
            await provider.save();
        }
        logger.info(`STATSports club ${this.clubId} synced chunks=${totals.chunks} bundles=${totals.bundles} rows=${totals.rows} imported=${totals.imported} createdActivities=${totals.createdActivities} createdPeriods=${totals.createdPeriods} createdEvents=${totals.createdEvents} linkedEvents=${totals.linkedEvents} skippedNoPlayerId=${totals.skippedNoPlayerId} skippedNoAthlete=${totals.skippedNoAthlete} failed=${totals.failed}`);
        return totals;
    }
    async *iterateMappedChunks(range) {
        const start = parseIsoDateTime(range.sessionStart);
        const end = parseIsoDateTime(range.sessionEnd);
        if (end < start) {
            throw new Error('sessionEnd must be >= sessionStart');
        }
        const chunkDays = range.chunkDays ?? STATSSPORTS_API_CONFIG.chunkDays;
        const windows = [...iterateChunks(start, end, chunkDays)];
        for (const [index, [chunkStart, chunkEnd]] of windows.entries()) {
            logger.info(`STATSports club ${this.clubId} chunk ${index + 1}/${windows.length} fetching ${toIsoZ(chunkStart)} → ${toIsoZ(chunkEnd)}`);
            const bundles = await this.fetchBundles(chunkStart, chunkEnd);
            yield {
                start: toIsoZ(chunkStart),
                end: toIsoZ(chunkEnd),
                bundles: bundles.length,
                rows: bundles.flatMap(mapBundleToRows),
            };
        }
    }
    async fetchMappedRows(options) {
        const rows = [];
        let chunks = 0;
        let bundles = 0;
        for await (const chunk of this.iterateMappedChunks(options)) {
            chunks++;
            bundles += chunk.bundles;
            rows.push(...chunk.rows);
            if (options.maxRows !== undefined && rows.length >= options.maxRows) {
                break;
            }
        }
        return {
            clubId: this.clubId,
            sessionStart: options.sessionStart,
            sessionEnd: options.sessionEnd,
            chunks,
            bundles,
            rows: options.maxRows !== undefined ? rows.slice(0, options.maxRows) : rows,
        };
    }
    async fetchBundles(start, end, depth = 0) {
        try {
            return await this.postSessionsWithRetry(start, end);
        }
        catch (error) {
            if (!isRetryable(error)) {
                if (axios.isAxiosError(error) && error.response?.status === 301) {
                    throw new Error(`STATSports redirect (301) for club ${this.clubId} — check club_providers.accessToken (thirdPartyApiId)`);
                }
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`STATSports fetch failed on ${toIsoZ(start)} → ${toIsoZ(end)}: ${message}`);
            }
            if (depth >= STATSSPORTS_API_CONFIG.maxSplitDepth) {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`STATSports fetch failed after ${STATSSPORTS_API_CONFIG.maxSplitDepth} splits on ${toIsoZ(start)} → ${toIsoZ(end)}: ${message}`);
            }
            let split;
            try {
                split = splitWindow(start, end);
            }
            catch (splitError) {
                const message = error instanceof Error ? error.message : String(error);
                const splitMessage = splitError instanceof Error ? splitError.message : String(splitError);
                throw new Error(`STATSports fetch failed on ${toIsoZ(start)} → ${toIsoZ(end)}: ${message}; ${splitMessage}`);
            }
            logger.warn(`STATSports club ${this.clubId} retryable error on ${toIsoZ(start)} → ${toIsoZ(end)}, splitting window (depth ${depth + 1})`);
            const [[leftStart, leftEnd], [rightStart, rightEnd]] = split;
            const left = await this.fetchBundles(leftStart, leftEnd, depth + 1);
            const right = await this.fetchBundles(rightStart, rightEnd, depth + 1);
            return [...left, ...right];
        }
    }
    async postSessionsWithRetry(start, end) {
        let lastError;
        for (let attempt = 0; attempt <= STATSSPORTS_API_CONFIG.maxRetries; attempt++) {
            try {
                return await this.postSessions(start, end);
            }
            catch (error) {
                lastError = error;
                if (!isRetryable(error) || attempt === STATSSPORTS_API_CONFIG.maxRetries) {
                    throw error;
                }
                const delay = STATSSPORTS_API_CONFIG.retryBaseDelayMs * 2 ** attempt;
                logger.warn(`STATSports club ${this.clubId} retry ${attempt + 1}/${STATSSPORTS_API_CONFIG.maxRetries} in ${delay}ms on ${toIsoZ(start)} → ${toIsoZ(end)}`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }
    async postSessions(start, end) {
        const response = await this.client.post(STATSSPORTS_API_CONFIG.getSessionsPath, {
            thirdPartyApiId: this.thirdPartyApiId,
            sessionStartDate: toIsoZ(start),
            sessionEndDate: toIsoZ(end),
        }, { headers: { 'Content-Type': 'application/json' } });
        return Array.isArray(response.data) ? response.data : [];
    }
}
//# sourceMappingURL=statsports_service.js.map