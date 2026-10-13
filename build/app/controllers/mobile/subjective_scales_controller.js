import AthleteService from '#services/athlete_service';
import { SubjectiveScaleService } from '#services/subjective_scale_service';
import { getLanguageFromRequest } from '#utils/language';
export default class SubjectiveScalesController {
    athleteService;
    subjectiveScaleService;
    constructor() {
        this.athleteService = new AthleteService();
        this.subjectiveScaleService = new SubjectiveScaleService();
    }
    async getScales({ response, athlete, request }) {
        const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
        if (!athleteRecord) {
            return response.notFound({ message: 'Athlete not found' });
        }
        const language = getLanguageFromRequest(request);
        const scales = await this.subjectiveScaleService.getScales(athleteRecord.clubId ?? null, language);
        return response.json(scales);
    }
}
//# sourceMappingURL=subjective_scales_controller.js.map