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
import { WhoopService } from '#services/whoop_service';
let ProcessWhoopWebhookJob = class ProcessWhoopWebhookJob extends Job {
    whoopService;
    static defaultQueue = 'whoop';
    constructor(whoopService) {
        super();
        this.whoopService = whoopService;
    }
    async process() {
        try {
            this.logger.info('Processing Whoop webhook', {
                whoopUserId: this.data.user_id,
                type: this.data.type,
                objectId: this.data.id,
            });
            await this.whoopService.processWebhook(this.data);
            return { success: true };
        }
        catch (error) {
            this.fail(error);
        }
    }
};
ProcessWhoopWebhookJob = __decorate([
    inject(),
    __metadata("design:paramtypes", [WhoopService])
], ProcessWhoopWebhookJob);
export default ProcessWhoopWebhookJob;
//# sourceMappingURL=process_whoop_webhook_job.js.map