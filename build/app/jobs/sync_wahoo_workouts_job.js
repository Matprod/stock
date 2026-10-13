var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Job } from '@nemoventures/adonis-jobs';
import { inject } from '@adonisjs/core';
import { WahooService } from '#services/wahoo_service';
let SyncWahooWorkoutsJob = class SyncWahooWorkoutsJob extends Job {
    wahooService;
    static defaultQueue = 'wahoo';
    constructor(wahooService) {
        super();
        this.wahooService = wahooService;
    }
    async process() {
        try {
            this.logger.info('Syncing historical Wahoo workouts', {
                athleteId: this.data.athleteId,
            });
            const result = await this.wahooService.syncHistoricalWorkouts(this.data.athleteId);
            return { success: true, ...result };
        }
        catch (error) {
            this.fail(error);
        }
    }
};
SyncWahooWorkoutsJob = __decorate([
    inject(),
    __metadata("design:paramtypes", [WahooService])
], SyncWahooWorkoutsJob);
export default SyncWahooWorkoutsJob;
//# sourceMappingURL=sync_wahoo_workouts_job.js.map