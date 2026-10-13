import { Job } from '@nemoventures/adonis-jobs';
import { DateTime } from 'luxon';
import { CatapultService } from '#services/catapult_service';
import ProcessSunderlandScore from '#jobs/process_sunderland_score_job';
import AthleteProvider from '#models_pg/athlete_provider';
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
export default class ProcessCatapultJob extends Job {
    static defaultQueue = 'catapult';
    async process() {
        try {
            const periods = this.data.periods;
            if (periods.length === 0) {
                return { success: false, error: 'no-period' };
            }
            this.logger.info('Processing catapult periods', this.data);
            const catapultService = await CatapultService.fromClubId(this.data.clubId);
            const sportActivity = await catapultService.processPlayerPeriods(this.data.athleteCatapultId, periods[0].activity_name, this.data.periods);
            if (sportActivity) {
                const activityDate = DateTime.fromFormat(periods[0].date, 'dd/MM/yyyy');
                const today = DateTime.now().toFormat('yyyy-MM-dd');
                if (activityDate.isValid && activityDate.toFormat('yyyy-MM-dd') !== today) {
                    const provider = await AthleteProvider.query()
                        .where('provider', ATHLETE_PROVIDER_TYPES.CATAPULT)
                        .where('providerAthleteId', this.data.athleteCatapultId)
                        .first();
                    if (provider) {
                        ProcessSunderlandScore.dispatch({
                            date: activityDate.toFormat('yyyy-MM-dd'),
                            athleteId: provider.athleteId,
                            sendSlack: true,
                        });
                    }
                }
            }
            return { success: true };
        }
        catch (error) {
            this.fail(error);
        }
    }
}
//# sourceMappingURL=process_catapult_job.js.map