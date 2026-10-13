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
import { HAMBURG_ML_STAGES, buildRangeBatches } from '#constants/hamburg_ml.constants';
import { HamburgPipelineService } from '#services/machine_learning/hamburg/hamburg_pipeline_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import db from '@adonisjs/lucid/services/db';
import { DateTime } from 'luxon';
function toIsoDate(value) {
    if (value instanceof Date)
        return DateTime.fromJSDate(value, { zone: 'utc' }).toISODate();
    if (typeof value === 'string' && value.length >= 10)
        return value.slice(0, 10);
    return null;
}
export default class HambourgMlBackfillStatsports extends BaseCommand {
    static commandName = 'hambourg:ml-backfill-statsports';
    static description = 'Backfill statsports-complete in 92-day batches from first to last Hamburg StatSports activity';
    static options = {
        startApp: true,
    };
    async run() {
        const range = await this.resolveRange();
        if (!range) {
            this.logger.error('No Hamburg StatSports activities found');
            this.exitCode = 1;
            return;
        }
        const batches = buildRangeBatches(range.start, range.end);
        this.logger.info(`range ${range.start} .. ${range.end} (${batches.length} batches)`);
        for (const [index, batch] of batches.entries()) {
            this.logger.info(`[${index + 1}/${batches.length}] ${batch.start} .. ${batch.end}`);
        }
        if (this.dryRun)
            return;
        const service = new HamburgPipelineService();
        for (const [index, batch] of batches.entries()) {
            this.logger.info(`running [${index + 1}/${batches.length}] ${batch.start} .. ${batch.end}`);
            try {
                const players = await service.runStage(HAMBURG_ML_STAGES.statsportsComplete, {
                    start_date: batch.start,
                    end_date: batch.end,
                });
                this.logger.info(`done players=${players.length}`);
            }
            catch (error) {
                this.logger.error(`failed at ${batch.start} .. ${batch.end} — resume with --start ${batch.start}`);
                throw error;
            }
        }
    }
    async resolveRange() {
        if (this.start && this.end)
            return { start: this.start, end: this.end };
        const row = await db
            .from('sport_activities')
            .innerJoin('days', 'days.id', 'sport_activities.day_id')
            .innerJoin('athletes', 'athletes.id', 'days.athlete_id')
            .where('sport_activities.data_source', 'statsports')
            .where('athletes.club_id', HAMBOURG_CLUB_ID)
            .min('days.date_of_day as first_date')
            .max('days.date_of_day as last_date')
            .first();
        const first = toIsoDate(row?.first_date);
        const last = toIsoDate(row?.last_date);
        if (!first || !last)
            return null;
        return {
            start: this.start || first,
            end: this.end || last,
        };
    }
}
__decorate([
    flags.string({ description: 'Override range start YYYY-MM-DD' }),
    __metadata("design:type", String)
], HambourgMlBackfillStatsports.prototype, "start", void 0);
__decorate([
    flags.string({ description: 'Override range end YYYY-MM-DD' }),
    __metadata("design:type", String)
], HambourgMlBackfillStatsports.prototype, "end", void 0);
__decorate([
    flags.boolean({ description: 'Print batches without calling ml-backend' }),
    __metadata("design:type", Boolean)
], HambourgMlBackfillStatsports.prototype, "dryRun", void 0);
//# sourceMappingURL=hambourg_ml_backfill_statsports.js.map