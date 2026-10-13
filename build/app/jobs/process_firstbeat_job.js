var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { inject } from '@adonisjs/core';
import FirstbeatService from '#services/firstbeat_service';
import { Job } from '@nemoventures/adonis-jobs';
let ProcessFirstbeatJob = class ProcessFirstbeatJob extends Job {
    firstbeatService;
    static defaultQueue = 'firstBeat';
    constructor(firstbeatService) {
        super();
        this.firstbeatService = firstbeatService;
    }
    async process() {
        try {
            this.logger.info('Processing firstbeat measurement', this.data);
            await this.firstbeatService.processFirstbeatMeasurements(this.data);
            return { success: true };
        }
        catch (error) {
            this.fail(error);
        }
    }
};
ProcessFirstbeatJob = __decorate([
    inject(),
    __metadata("design:paramtypes", [FirstbeatService])
], ProcessFirstbeatJob);
export default ProcessFirstbeatJob;
//# sourceMappingURL=process_firstbeat_job.js.map