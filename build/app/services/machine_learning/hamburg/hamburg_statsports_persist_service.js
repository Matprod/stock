import { HAMBURG_ML_PERIOD_PROVIDER_ID, HAMBURG_ML_PERSIST_CHUNK_SIZE, } from '#constants/hamburg_ml.constants';
import Period from '#models_pg/period';
import SportActivity from '#models_pg/sport_activity';
import logger from '@adonisjs/core/services/logger';
import db from '@adonisjs/lucid/services/db';
export class HamburgStatsportsPersistService {
    async persist(players) {
        const trx = await db.transaction();
        try {
            const periodIdBySportActivityId = await this.ensurePeriodsForGpsLessMatches(players, trx);
            const entries = this.collectEntries(players, periodIdBySportActivityId);
            for (let i = 0; i < entries.length; i += HAMBURG_ML_PERSIST_CHUNK_SIZE) {
                await trx
                    .knexQuery()
                    .table('data_processed_metric_values')
                    .insert(entries.slice(i, i + HAMBURG_ML_PERSIST_CHUNK_SIZE))
                    .onConflict(['period_id', 'metric_id'])
                    .merge(['value']);
            }
            await trx.commit();
            logger.info(`Hamburg ML statsports-complete: persisted ${entries.length} metric values`);
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    collectEntries(players, periodIdBySportActivityId) {
        const entries = new Map();
        for (const player of players) {
            for (const period of player.periods ?? []) {
                const sportActivityId = period.sport_activity_id ?? period.sport_activity?.id ?? null;
                const periodId = period.id ?? (sportActivityId ? periodIdBySportActivityId.get(sportActivityId) : undefined);
                if (!periodId)
                    continue;
                for (const metric of period.metrics) {
                    if (!metric.id)
                        continue;
                    const value = this.serializeValue(metric.value);
                    if (value === null)
                        continue;
                    entries.set(`${periodId}:${metric.id}`, {
                        period_id: periodId,
                        metric_id: metric.id,
                        value,
                    });
                }
            }
        }
        return [...entries.values()];
    }
    serializeValue(value) {
        if (value === null)
            return null;
        if (typeof value === 'string')
            return value;
        if (!Number.isFinite(value))
            return null;
        return String(Math.round(value * 1e6) / 1e6);
    }
    async ensurePeriodsForGpsLessMatches(players, trx) {
        const sportActivityIds = [
            ...new Set(players.flatMap((player) => player.periods?.flatMap((period) => {
                const sportActivityId = period.sport_activity_id ?? period.sport_activity?.id ?? null;
                return period.id || !sportActivityId ? [] : [sportActivityId];
            }) ?? [])),
        ];
        const periodIdBySportActivityId = new Map();
        if (sportActivityIds.length === 0)
            return periodIdBySportActivityId;
        const existing = await Period.query({ client: trx })
            .whereIn('sportActivityId', sportActivityIds)
            .where('providerId', HAMBURG_ML_PERIOD_PROVIDER_ID);
        for (const period of existing) {
            periodIdBySportActivityId.set(period.sportActivityId, period.id);
        }
        const missingIds = sportActivityIds.filter((id) => !periodIdBySportActivityId.has(id));
        if (missingIds.length === 0)
            return periodIdBySportActivityId;
        const activities = await SportActivity.query({ client: trx }).whereIn('id', missingIds);
        for (const activity of activities) {
            const period = await Period.create({
                sportActivityId: activity.id,
                providerId: HAMBURG_ML_PERIOD_PROVIDER_ID,
                name: activity.activityName,
                needsReview: false,
            }, { client: trx });
            periodIdBySportActivityId.set(activity.id, period.id);
        }
        logger.info(`Hamburg ML statsports-complete: created ${activities.length} periods for GPS-less matches`);
        return periodIdBySportActivityId;
    }
}
//# sourceMappingURL=hamburg_statsports_persist_service.js.map