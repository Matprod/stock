var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import SunderlandScoreService from '#services/machine_learning/sunderland_score_service';
import { BaseCommand, flags } from '@adonisjs/core/ace';
import { DateTime } from 'luxon';
export default class SunderlandScores extends BaseCommand {
    static commandName = 'sunderland:scores';
    static description = 'Regenerate Sunderland scores and chatbot reports for a date range';
    static options = {
        startApp: true,
    };
    async run() {
        if (!this.from)
            throw new Error('--from is required (yyyy-MM-dd)');
        const startDate = DateTime.fromISO(this.from, { zone: 'utc' }).startOf('day');
        const endDate = (this.to
            ? DateTime.fromISO(this.to, { zone: 'utc' })
            : DateTime.utc().minus({ days: 1 })).startOf('day');
        if (!startDate.isValid)
            throw new Error(`Invalid --from ${this.from}`);
        if (!endDate.isValid)
            throw new Error(`Invalid --to ${this.to}`);
        if (endDate < startDate)
            throw new Error('--to must be on or after --from');
        const days = Math.floor(endDate.diff(startDate, 'days').days) + 1;
        this.logger.info(`Sunderland scores ${startDate.toISODate()} → ${endDate.toISODate()} (${days} day(s))${this.athleteId ? ` athlete=${this.athleteId}` : ''}`);
        const service = new SunderlandScoreService();
        for (let cursor = startDate; cursor <= endDate; cursor = cursor.plus({ days: 1 })) {
            const dateStr = cursor.toISODate();
            this.logger.info(`Processing ${dateStr}`);
            try {
                await service.generateScoresForAllAthletes(cursor, {
                    sendSlack: this.slack,
                    athleteId: this.athleteId,
                });
                this.logger.info(`Done ${dateStr}`);
            }
            catch (error) {
                this.logger.error(`Failed ${dateStr}: ${error instanceof Error ? error.message : String(error)}`);
                this.exitCode = 1;
            }
        }
    }
}
__decorate([
    flags.string({ description: 'From ISO date (inclusive)' }),
    __metadata("design:type", String)
], SunderlandScores.prototype, "from", void 0);
__decorate([
    flags.string({ description: 'To ISO date (inclusive, default yesterday)' }),
    __metadata("design:type", Object)
], SunderlandScores.prototype, "to", void 0);
__decorate([
    flags.string({ description: 'Limit to one athlete id' }),
    __metadata("design:type", Object)
], SunderlandScores.prototype, "athleteId", void 0);
__decorate([
    flags.boolean({ description: 'Post Slack progress messages', default: false }),
    __metadata("design:type", Boolean)
], SunderlandScores.prototype, "slack", void 0);
//# sourceMappingURL=sunderland_scores.js.map