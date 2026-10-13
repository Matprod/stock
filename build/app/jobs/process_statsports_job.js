import { Job } from '@nemoventures/adonis-jobs';
import { StatssportsService } from '#services/statsports_service';
export default class ProcessStatssportsJob extends Job {
    static defaultQueue = 'statsports';
    async process() {
        try {
            this.logger.info('Processing STATSports sync', this.data);
            const service = await StatssportsService.fromClubId(this.data.clubId);
            return await service.syncDateRange({
                sessionStart: this.data.sessionStart,
                sessionEnd: this.data.sessionEnd,
                chunkDays: this.data.chunkDays,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.fail(message);
        }
    }
}
//# sourceMappingURL=process_statsports_job.js.map