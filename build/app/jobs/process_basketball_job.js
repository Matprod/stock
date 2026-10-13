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
import { Job } from '@nemoventures/adonis-jobs';
import { BasketballService } from '#services/api_basketball_service';
import SlackService from '#services/slack_service';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 15000;
function isDbTimeout(error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : '';
    return `${msg} ${code}`.toUpperCase().includes('ETIMEDOUT');
}
let ProcessBasketballJob = class ProcessBasketballJob extends Job {
    basketballService;
    slackService;
    static defaultQueue = 'basketball';
    constructor(basketballService, slackService) {
        super();
        this.basketballService = basketballService;
        this.slackService = slackService;
    }
    async process() {
        const { athleteId, game } = this.data;
        const gameId = game?.id;
        try {
            let lastError;
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    await this.basketballService.persistSportActivity(this.data);
                    return { success: true };
                }
                catch (error) {
                    lastError = error;
                    if (attempt === MAX_RETRIES || !isDbTimeout(error))
                        throw error;
                    const delayMs = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
                    await new Promise((r) => setTimeout(r, delayMs));
                }
            }
            throw lastError;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            const msg = err.message;
            this.logger.error({ athleteId, gameId, stack: err.stack }, `ProcessBasketballJob failed: ${msg}`);
            try {
                await this.slackService.sendMessage(':rotating_light: Basketball queue failed.', 'match');
            }
            catch (slackError) {
                this.logger.warn({ athleteId, gameId, error: slackError }, 'Failed to send Slack alert for ProcessBasketballJob failure');
            }
            return { success: false, error: msg };
        }
    }
};
ProcessBasketballJob = __decorate([
    inject(),
    __metadata("design:paramtypes", [BasketballService,
        SlackService])
], ProcessBasketballJob);
export default ProcessBasketballJob;
//# sourceMappingURL=process_basketball_job.js.map