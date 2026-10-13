import { Job } from '@nemoventures/adonis-jobs';
import { DflService } from '#services/dfl_service';
import { SkillcornerService } from '#services/skillcorner_service';
export default class ProcessMatchProvidersJob extends Job {
    static defaultQueue = 'match_providers';
    async process() {
        try {
            this.logger.info('Processing match providers sync (DFL then SkillCorner)', this.data);
            const dfl = await DflService.syncAllClubs(this.data.from);
            const skillcorner = await SkillcornerService.syncAllClubs(this.data.from);
            this.logger.info('Match providers sync finished', {
                from: this.data.from,
                dflClubs: dfl.length,
                skillcornerClubs: skillcorner.length,
            });
            return { from: this.data.from, dfl, skillcorner };
        }
        catch (error) {
            this.fail(error);
        }
    }
}
//# sourceMappingURL=process_match_providers_job.js.map