import { Job } from '@nemoventures/adonis-jobs';
export default class CalculateScoresJob extends Job {
    static defaultQueue = 'default';
    async process() {
        try {
            this.logger.info('Calculating scores for period', this.data);
            return { success: true };
        }
        catch (error) {
            this.fail(error);
        }
    }
}
//# sourceMappingURL=calculate_scores_job.js.map