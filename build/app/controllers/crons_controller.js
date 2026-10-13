import AthleteProvider from '#models_pg/athlete_provider';
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
import { DateTime } from 'luxon';
import ValdService from '#services/vald_service';
import FirstbeatService from '#services/firstbeat_service';
import { BasketballService } from '#services/api_basketball_service';
import { NotificationService } from '#services/notification_service';
import { CatapultService } from '#services/catapult_service';
import { StatssportsService } from '#services/statsports_service';
import SlackService from '#services/slack_service';
import { STATSSPORTS_API_CONFIG } from '#constants/statsports.constants';
import { MATCH_PROVIDERS_SYNC_LOOKBACK_DAYS } from '#constants/dfl.constants';
import SunderlandScoreService from '#services/machine_learning/sunderland_score_service';
export default class CronsController {
    firstbeatService;
    notificationService;
    basketballService;
    slackService;
    constructor() {
        this.firstbeatService = new FirstbeatService();
        this.notificationService = new NotificationService();
        this.basketballService = new BasketballService();
        this.slackService = new SlackService();
    }
    async generateSunderlandScoresForAllAthletes() {
        const yesterday = DateTime.now().minus({ days: 1 }).startOf('day');
        const sunderlandScoreService = new SunderlandScoreService();
        await sunderlandScoreService.generateScoresForAllAthletes(yesterday, {
            sendSlack: true,
        });
    }
    async fetchCatapultActivities(ctx) {
        try {
            const startDate = DateTime.now().minus({ days: 7 });
            const results = await CatapultService.fetchAndQueueForAllClubs(startDate);
            if (results.length === 0) {
                await this.slackService.sendMessage('Catapult sync skipped: no club provider configured with accessToken and providerTeamId', 'logs');
                return ctx.response.status(202).send({
                    message: 'No Catapult club providers configured',
                    results: [],
                });
            }
            const summaryLines = results.map((result) => {
                if (result.error) {
                    return `Club ${result.clubId}: error — ${result.error}`;
                }
                return `Club ${result.clubId}: ${result.activityCount} activities, ${result.queuedJobs} jobs queued`;
            });
            await this.slackService.sendMessage(`Catapult sync (${startDate.toFormat('yyyy-MM-dd')} → ${DateTime.now().toFormat('yyyy-MM-dd')}):\n${summaryLines.join('\n')}\nCheck <https://api.v2.mauna-ai.com/admin/queue/catapult|queue status>`, 'logs');
            return ctx.response.status(202).send({
                message: 'Catapult activities fetched and queued for processing',
                results,
            });
        }
        catch (error) {
            console.error('Error fetching catapult activities:', error);
            return ctx.response.status(400).send({
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            });
        }
    }
    async fetchStatssportsActivities(ctx) {
        try {
            const endDate = DateTime.utc();
            const startDate = endDate
                .minus({ days: STATSSPORTS_API_CONFIG.syncLookbackDays })
                .startOf('day');
            const results = await StatssportsService.fetchAndQueueForAllClubs(startDate, endDate);
            if (results.length === 0) {
                await this.slackService.sendMessage('STATSports sync skipped: no club provider configured with accessToken', 'logs');
                return ctx.response.status(202).send({
                    message: 'No STATSports club providers configured',
                    results: [],
                });
            }
            const summaryLines = results.map((result) => {
                if (result.error) {
                    return `Club ${result.clubId}: error — ${result.error}`;
                }
                return `Club ${result.clubId}: job queued`;
            });
            await this.slackService.sendMessage(`STATSports sync queued (${startDate.toFormat('yyyy-MM-dd')} → ${endDate.toFormat('yyyy-MM-dd')}):\n${summaryLines.join('\n')}\nCheck <https://api.v2.mauna-ai.com/admin/queue/statsports|queue status>`, 'logs');
            return ctx.response.status(202).send({
                message: 'STATSports activities queued for processing',
                results,
            });
        }
        catch (error) {
            console.error('Error fetching statsports activities:', error);
            return ctx.response.status(400).send({
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            });
        }
    }
    async fetchMatchProviders(ctx) {
        try {
            const from = DateTime.utc().minus({ days: MATCH_PROVIDERS_SYNC_LOOKBACK_DAYS }).toISODate();
            if (!from) {
                return ctx.response.status(400).send({ error: 'Could not compute lookback date' });
            }
            const { default: ProcessMatchProvidersJob } = await import('#jobs/process_match_providers_job');
            await ProcessMatchProvidersJob.dispatch({ from });
            await this.slackService.sendMessage(`Match providers sync queued (DFL then SkillCorner, from ${from})\nCheck <https://api.v2.mauna-ai.com/admin/queue/match_providers|queue status>`, 'logs');
            return ctx.response.status(202).send({
                message: 'DFL then SkillCorner sync queued',
                from,
            });
        }
        catch (error) {
            console.error('Error queueing match providers sync:', error);
            return ctx.response.status(400).send({
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            });
        }
    }
    async syncValdAthletes() {
        return ValdService.syncAllClubs();
    }
    async syncFirstbeatAthletes() {
        const providers = await AthleteProvider.query()
            .where('provider', ATHLETE_PROVIDER_TYPES.FIRSTBEAT)
            .whereNotNull('providerAthleteId')
            .preload('athlete', (query) => {
            query.preload('athleteProviders', (providersQuery) => {
                providersQuery
                    .where('provider', ATHLETE_PROVIDER_TYPES.FIRSTBEAT)
                    .whereNotNull('providerAthleteId');
            });
        });
        const startDate = DateTime.now().minus({ day: 7 });
        return Promise.allSettled(providers.map(async (provider) => {
            if (provider.athlete) {
                await this.firstbeatService.syncAthlete({ athlete: provider.athlete, startDate });
            }
        }));
    }
    async syncAndStoreBasketball({ response }) {
        await this.basketballService.syncBasketballAthletes();
        const result = await this.basketballService.runStoreBasketballMatchsAllLeagues();
        return response.ok({
            success: result.success,
            stored: result.stored,
            total: result.total,
            error: result.error,
            message: result.success
                ? `Basketball sync and store completed (${result.stored}/${result.total} games). Activity jobs have been launched.`
                : `Basketball sync completed; store failed: ${result.error ?? 'unknown'}`,
        });
    }
    async sendNotifications({ response }) {
        const now = DateTime.now().setZone('Europe/Paris');
        const currentTimeFrench = now.setLocale('fr').toFormat('HH:mm');
        const currentDay = now.toFormat('EEEE').toUpperCase();
        const currentDate = now.toFormat('yyyy-MM-dd');
        const notifications = await this.notificationService.getScheduledNotifications(currentTimeFrench, currentDay, currentDate);
        const notificationMessagesToSend = await this.notificationService.buildNotificationMessages(notifications);
        await this.notificationService.sendNotificationMessages(notificationMessagesToSend);
        const notificationsToSend = notifications.map((notification) => {
            return {
                title: notification.title,
                date: notification.date,
                time: notification.time,
                day: notification.day,
                clubId: notification.clubId,
                athleteIds: notification.athletes.map((athletes) => athletes.id),
            };
        });
        return response.ok({
            success: true,
            notificationsToSend,
            sent: notificationMessagesToSend.length,
        });
    }
}
//# sourceMappingURL=crons_controller.js.map