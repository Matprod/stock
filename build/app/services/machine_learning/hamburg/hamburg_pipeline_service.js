import { HAMBURG_ML_API_CONFIG, HAMBURG_ML_INJURY_MAX_RANGE_DAYS, HAMBURG_ML_STAGES, buildRangeBatches, } from '#constants/hamburg_ml.constants';
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants';
import { HamburgDailyFactorsPersistService } from '#services/machine_learning/hamburg/hamburg_daily_factors_persist_service';
import { HamburgInjuryPersistService } from '#services/machine_learning/hamburg/hamburg_injury_persist_service';
import { HamburgPerformancePersistService } from '#services/machine_learning/hamburg/hamburg_performance_persist_service';
import { HamburgStatsportsPersistService } from '#services/machine_learning/hamburg/hamburg_statsports_persist_service';
import { HamburgSubjectivePersistService } from '#services/machine_learning/hamburg/hamburg_subjective_persist_service';
import env from '#start/env';
import logger from '@adonisjs/core/services/logger';
import axios, { AxiosError } from 'axios';
import { writeFile } from 'node:fs/promises';
export class HamburgPipelineService {
    statsportsPersist;
    subjectivePersist;
    dailyFactorsPersist;
    injuryPersist;
    performancePersist;
    client;
    constructor(statsportsPersist = new HamburgStatsportsPersistService(), subjectivePersist = new HamburgSubjectivePersistService(), dailyFactorsPersist = new HamburgDailyFactorsPersistService(), injuryPersist = new HamburgInjuryPersistService(), performancePersist = new HamburgPerformancePersistService()) {
        this.statsportsPersist = statsportsPersist;
        this.subjectivePersist = subjectivePersist;
        this.dailyFactorsPersist = dailyFactorsPersist;
        this.injuryPersist = injuryPersist;
        this.performancePersist = performancePersist;
        this.client = axios.create({
            baseURL: env.get('MACHINE_LEARNING_HAMBURG_BASE_URL').replace(/\/$/, ''),
            timeout: HAMBURG_ML_API_CONFIG.timeoutMs,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.get('API_TOKEN')}`,
            },
        });
    }
    async runStage(stage, request, options = {}) {
        if (!('start_date' in request) || !request.start_date || !request.end_date) {
            return this.runSingleCall(stage, request, options);
        }
        const maxRangeDays = stage === HAMBURG_ML_STAGES.predictInjury || stage === HAMBURG_ML_STAGES.predictPerformance
            ? HAMBURG_ML_INJURY_MAX_RANGE_DAYS
            : undefined;
        const batches = buildRangeBatches(request.start_date, request.end_date, maxRangeDays);
        let lastResult = [];
        const failures = [];
        for (const [index, batch] of batches.entries()) {
            logger.info(`Hamburg ML ${stage}: batch [${index + 1}/${batches.length}] ${batch.start} .. ${batch.end}`);
            try {
                lastResult = await this.runSingleCall(stage, {
                    start_date: batch.start,
                    end_date: batch.end,
                    athlete_ids: request.athlete_ids,
                    club_id: request.club_id,
                }, options);
                logger.info(`Hamburg ML ${stage}: batch done n=${lastResult.length}`);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                failures.push({ start: batch.start, end: batch.end, message });
                logger.error(`Hamburg ML ${stage}: batch failed ${batch.start} .. ${batch.end} — ${message}`);
            }
        }
        if (failures.length > 0) {
            throw new Error(`Hamburg ML ${stage}: ${failures.length}/${batches.length} batch(es) failed: ${failures
                .map((failure) => `${failure.start} .. ${failure.end}`)
                .join(', ')}`);
        }
        return lastResult;
    }
    async runSingleCall(stage, request, options) {
        const path = `/clubs/${options.clubRef ?? HAMBOURG_CLUB_ID}/${stage}`;
        const payload = await this.postWithRetry(stage, path, request);
        if (options.dumpPath) {
            await writeFile(options.dumpPath, JSON.stringify(payload, null, 2));
        }
        if (stage === HAMBURG_ML_STAGES.predictInjury) {
            const rows = this.extractRows(payload);
            if (!options.skipPersist) {
                await this.injuryPersist.persist(rows);
            }
            return rows;
        }
        if (stage === HAMBURG_ML_STAGES.predictPerformance) {
            const rows = this.extractRows(payload);
            if (!options.skipPersist) {
                await this.performancePersist.persist(rows);
            }
            return rows;
        }
        const players = this.extractPlayers(payload);
        if (!options.skipPersist && stage === HAMBURG_ML_STAGES.statsportsComplete) {
            await this.statsportsPersist.persist(players);
        }
        if (!options.skipPersist && stage === HAMBURG_ML_STAGES.subjectiveImputation) {
            await this.subjectivePersist.persist(players, request);
        }
        if (!options.skipPersist && stage === HAMBURG_ML_STAGES.dailyFactors) {
            await this.dailyFactorsPersist.persist(players, request);
        }
        return players;
    }
    extractRows(payload) {
        if (!payload || typeof payload !== 'object')
            return [];
        const rows = payload.rows;
        return Array.isArray(rows) ? rows : [];
    }
    async postWithRetry(stage, path, request) {
        const body = { ...request, format: 'db' };
        let lastError;
        for (let attempt = 1; attempt <= HAMBURG_ML_API_CONFIG.maxRetries; attempt++) {
            try {
                const response = await this.client.post(path, body);
                return response.data;
            }
            catch (error) {
                lastError = error;
                if (!this.isRetryable(error) || attempt >= HAMBURG_ML_API_CONFIG.maxRetries) {
                    throw this.wrapAxiosError(error, stage, path);
                }
                const waitMs = HAMBURG_ML_API_CONFIG.retryBaseDelayMs * 2 ** (attempt - 1);
                const status = error instanceof AxiosError ? error.response?.status : undefined;
                logger.warn(`Hamburg ML ${stage}: ${status ?? 'network'} retry ${attempt}/${HAMBURG_ML_API_CONFIG.maxRetries} in ${waitMs / 1000}s`);
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
        }
        throw this.wrapAxiosError(lastError, stage, path);
    }
    isRetryable(error) {
        if (!(error instanceof AxiosError))
            return false;
        if (error.code === 'ECONNABORTED' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNRESET' ||
            error.message.includes('socket hang up')) {
            return true;
        }
        const status = error.response?.status;
        const detail = this.extractErrorDetail(error.response?.data);
        if (detail && /MAX_ROWS|Too many rows|Gateway injury -> 400/i.test(detail)) {
            return false;
        }
        return status === 502 || status === 503 || status === 504;
    }
    extractPlayers(payload) {
        if (Array.isArray(payload))
            return payload;
        if (!payload || typeof payload !== 'object')
            return [];
        const record = payload;
        if (Array.isArray(record.data))
            return record.data;
        return [];
    }
    wrapAxiosError(error, stage, path) {
        if (!(error instanceof AxiosError)) {
            return error instanceof Error ? error : new Error(String(error));
        }
        const status = error.response?.status;
        const detail = this.extractErrorDetail(error.response?.data);
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return new Error(`Hamburg ML ${stage}: timed out after ${HAMBURG_ML_API_CONFIG.timeoutMs / 1000}s (ml-backend did not respond)`);
        }
        if (status === 401) {
            return new Error(`Hamburg ML ${stage}: unauthorized (check API_TOKEN)${detail ? `: ${detail}` : ''}`);
        }
        if (status === 422) {
            return new Error(`Hamburg ML ${stage}: validation error${detail ? `: ${detail}` : ''}`);
        }
        if (status === 500 && detail?.includes('API_TOKEN')) {
            return new Error(`Hamburg ML ${stage}: server misconfigured (API_TOKEN not set on ml-backend)`);
        }
        const message = detail ?? error.message;
        return new Error(`Hamburg ML ${stage} ${path} failed${status ? ` (${status})` : ''}: ${message}`);
    }
    extractErrorDetail(data) {
        if (data === null || data === undefined)
            return null;
        if (typeof data === 'string')
            return data;
        if (typeof data !== 'object')
            return String(data);
        const record = data;
        if (typeof record.detail === 'string')
            return record.detail;
        if (typeof record.message === 'string')
            return record.message;
        return JSON.stringify(data);
    }
}
//# sourceMappingURL=hamburg_pipeline_service.js.map