var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants';
import SportActivity from '#models_pg/sport_activity';
import SportActivityMetricValue from '#models_pg/sport_activity_metric_value';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
function isGenericMatchName(name) {
    if (!name)
        return true;
    const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
    return normalized === 'match day' || normalized === 'matchday';
}
function hasRealTime(time) {
    if (!time)
        return false;
    const trimmed = time.trim();
    return trimmed !== '' && trimmed !== '00:00:00' && trimmed !== '0:00:00' && trimmed !== '00:00';
}
function scoreActivity(activity, externalMetricCount) {
    let score = 0;
    score += externalMetricCount * 100;
    if (!isGenericMatchName(activity.activityName))
        score += 50;
    if (hasRealTime(activity.timeOfActivity))
        score += 10;
    return score;
}
export default class HambourgCleanupDuplicateMatchActivities extends BaseCommand {
    static commandName = 'hambourg:cleanup-duplicate-match-activities';
    static description = 'Delete same-day duplicate statsports game activities (keep named/DFL-enriched one)';
    static options = {
        startApp: true,
    };
    async run() {
        const clubId = this.clubId || HAMBOURG_CLUB_ID;
        const dryRun = !this.apply;
        console.log('');
        console.log(`Cleanup duplicate match activities club=${clubId} mode=${dryRun ? 'dry-run' : 'APPLY'}`);
        console.log('');
        const { rows } = await db.rawQuery(`
      SELECT
        d.id AS day_id,
        a.last_name,
        d.date_of_day::date::text AS day
      FROM sport_activities sa
      JOIN days d ON d.id = sa.day_id
      JOIN athletes a ON a.id = d.athlete_id
      WHERE a.club_id = ?
        AND sa.data_source = 'statsports'
        AND sa.game_activity IS TRUE
      GROUP BY d.id, a.last_name, d.date_of_day
      HAVING COUNT(*) > 1
      ORDER BY d.date_of_day DESC, a.last_name
      `, [clubId]);
        const dupDays = rows;
        console.log(`Found ${dupDays.length} day(s) with duplicate game activities`);
        console.log('');
        let deleted = 0;
        let kept = 0;
        let failed = 0;
        for (const dup of dupDays) {
            const activities = await SportActivity.query()
                .where('dayId', dup.day_id)
                .where('dataSource', 'statsports')
                .where('gameActivity', true)
                .orderBy('createdAt', 'asc');
            if (activities.length < 2)
                continue;
            const scored = await Promise.all(activities.map(async (activity) => {
                const countRow = await SportActivityMetricValue.query()
                    .where('sportActivityId', activity.id)
                    .whereIn('source', ['dfl', 'skillcorner'])
                    .count('* as total');
                const externalMetricCount = Number(countRow[0].$extras.total ?? 0);
                return {
                    activity,
                    externalMetricCount,
                    score: scoreActivity(activity, externalMetricCount),
                };
            }));
            scored.sort((a, b) => b.score - a.score || a.activity.createdAt.toMillis() - b.activity.createdAt.toMillis());
            const winner = scored[0];
            const losers = scored.slice(1);
            kept++;
            const betterName = scored.find((row) => !isGenericMatchName(row.activity.activityName))
                ?.activity.activityName;
            console.log(`  ${dup.last_name} ${dup.day}: KEEP "${winner.activity.activityName}" @ ${winner.activity.timeOfActivity}` +
                ` (dfl/sc=${winner.externalMetricCount})`);
            for (const loser of losers) {
                console.log(`    DELETE "${loser.activity.activityName}" @ ${loser.activity.timeOfActivity} (${loser.activity.id})`);
            }
            if (dryRun) {
                deleted += losers.length;
                continue;
            }
            try {
                await db.transaction(async (trx) => {
                    if (betterName &&
                        isGenericMatchName(winner.activity.activityName) &&
                        betterName !== winner.activity.activityName) {
                        winner.activity.activityName = betterName;
                        await winner.activity.useTransaction(trx).save();
                    }
                    for (const loser of losers) {
                        const loserMetrics = await SportActivityMetricValue.query({ client: trx })
                            .where('sportActivityId', loser.activity.id)
                            .whereIn('source', ['dfl', 'skillcorner']);
                        for (const metric of loserMetrics) {
                            const existing = await SportActivityMetricValue.query({ client: trx })
                                .where('sportActivityId', winner.activity.id)
                                .where('metricId', metric.metricId)
                                .where('source', metric.source)
                                .first();
                            if (!existing) {
                                metric.sportActivityId = winner.activity.id;
                                await metric.useTransaction(trx).save();
                            }
                        }
                        await SportActivity.query({ client: trx }).where('id', loser.activity.id).delete();
                        deleted++;
                    }
                });
            }
            catch (error) {
                failed++;
                console.log(`    FAILED: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        console.log('');
        console.log(`Groups: ${kept}`);
        console.log(`${dryRun ? 'Would delete' : 'Deleted'}: ${deleted}`);
        console.log(`Failed: ${failed}`);
        console.log('');
        if (dryRun) {
            this.logger.info('Dry-run only. Apply with:');
            this.logger.info('  node ace hambourg:cleanup-duplicate-match-activities --apply');
        }
        else {
            this.logger.success(`Deleted ${deleted} duplicate(s)`);
            this.logger.info('Refresh period metrics:');
            this.logger.info('  node ace hambourg:import-rows --limit 100000 --batchSize 50');
        }
    }
}
__decorate([
    flags.string({
        description: 'Club id',
        default: HAMBOURG_CLUB_ID,
    }),
    __metadata("design:type", String)
], HambourgCleanupDuplicateMatchActivities.prototype, "clubId", void 0);
__decorate([
    flags.boolean({
        description: 'Actually delete duplicates',
        default: false,
    }),
    __metadata("design:type", Boolean)
], HambourgCleanupDuplicateMatchActivities.prototype, "apply", void 0);
//# sourceMappingURL=hambourg_cleanup_duplicate_match_activities.js.map