var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { DateTime } from 'luxon';
import { Job } from '@nemoventures/adonis-jobs';
import SunderlandScoreService from '#services/machine_learning/sunderland_score_service';
import { inject } from '@adonisjs/core';
let ProcessSunderlandScore = class ProcessSunderlandScore extends Job {
    sunderlandScoreService;
    static defaultQueue = 'sunderland';
    constructor(sunderlandScoreService) {
        super();
        this.sunderlandScoreService = sunderlandScoreService;
    }
    async process() {
        const targetDate = DateTime.fromISO(this.data.date).startOf('day');
        if (!targetDate.isValid) {
            throw new Error(`Invalid date for ProcessSunderlandScore: ${this.data.date}`);
        }
        const sendSlack = this.data.sendSlack ?? true;
        try {
            await this.sunderlandScoreService.generateScoresForAllAthletes(targetDate, {
                sendSlack,
                athleteId: this.data.athleteId,
            });
        }
        catch (error) {
            this.fail(error);
        }
        return {
            date: this.data.date,
            athleteId: this.data.athleteId,
            completed: true,
        };
    }
};
ProcessSunderlandScore = __decorate([
    inject(),
    __metadata("design:paramtypes", [SunderlandScoreService])
], ProcessSunderlandScore);
export default ProcessSunderlandScore;
//# sourceMappingURL=process_sunderland_score_job.js.map