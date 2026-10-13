var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { inject } from '@adonisjs/core';
import ProcessGarminJob from '#jobs/process_garmin_job';
import ProcessGarminSleepJob from '#jobs/process_garmin_sleep_job';
import ProcessWahooWorkoutJob from '#jobs/process_wahoo_workout_job';
import ProcessWhoopWebhookJob from '#jobs/process_whoop_webhook_job';
let WebhooksController = class WebhooksController {
    async processGarminActivityDetails(ctx) {
        try {
            const receivedData = ctx.request.body()?.activityDetails || [];
            await ProcessGarminJob.dispatch(receivedData);
            return ctx.response.status(202).send({
                message: 'Webhook data received and queued for processing',
            });
        }
        catch (error) {
            console.error('Error processing Garmin webhook:', error);
            return ctx.response.status(400).send({
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            });
        }
    }
    async processGarminSleeps(ctx) {
        try {
            const receivedData = ctx.request.body()?.sleeps || [];
            if (!Array.isArray(receivedData) || receivedData.length === 0) {
                return ctx.response.status(400).send({ message: 'No sleep data received' });
            }
            await ProcessGarminSleepJob.dispatch(receivedData);
            return ctx.response.status(202).send({
                message: 'Sleep webhook data received and queued for processing',
            });
        }
        catch (error) {
            console.error('Error processing Garmin sleep webhook:', error);
            return ctx.response.status(400).send({
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            });
        }
    }
    async processWahooWorkoutSummary(ctx) {
        try {
            const receivedData = ctx.request.body();
            if (receivedData.event_type !== 'workout_summary') {
                return ctx.response.status(400).send({ message: 'Unsupported Wahoo webhook event type' });
            }
            await ProcessWahooWorkoutJob.dispatch(receivedData);
            return ctx.response.status(200).send({
                message: 'Webhook data received and queued for processing',
            });
        }
        catch (error) {
            console.error('Error processing Wahoo webhook:', error);
            return ctx.response.status(400).send({
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            });
        }
    }
    async processWhoopWebhook(ctx) {
        try {
            const payload = ctx.request.body();
            if (!payload?.type || !payload?.user_id || !payload?.id) {
                return ctx.response.status(400).send({ message: 'Missing required fields' });
            }
            await ProcessWhoopWebhookJob.dispatch(payload);
            return ctx.response.status(200).send({
                message: 'Webhook data received and queued for processing',
            });
        }
        catch (error) {
            console.error('Error processing Whoop webhook:', error);
            return ctx.response.status(400).send({
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            });
        }
    }
};
WebhooksController = __decorate([
    inject()
], WebhooksController);
export default WebhooksController;
//# sourceMappingURL=webhooks_controller.js.map