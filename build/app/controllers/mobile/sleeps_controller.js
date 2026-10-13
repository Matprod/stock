import { addSleepQuerySchema, addSleepSchema, getSleepSchema } from '#schemas/mobile/sleep';
import SleepService from '#services/mobile/sleep_service';
import AthleteService from '#services/athlete_service';
import { SubjectiveScaleService } from '#services/subjective_scale_service';
import { SubjectiveScaleValuesService } from '#services/subjective_scale_values_service';
import { SUBJECTIVE_VARIABLE_DOMAIN } from '#contracts/subjective_variable';
import { getLanguageFromRequest } from '#utils/language';
export default class SleepsController {
    sleepService;
    athleteService;
    subjectiveScaleService;
    subjectiveScaleValuesService;
    constructor() {
        this.sleepService = new SleepService();
        this.athleteService = new AthleteService();
        this.subjectiveScaleService = new SubjectiveScaleService();
        this.subjectiveScaleValuesService = new SubjectiveScaleValuesService();
    }
    async getSleepScales(athleteId, language) {
        const athleteRecord = await this.athleteService.getAthleteById(athleteId);
        if (!athleteRecord?.clubId) {
            return [];
        }
        return this.subjectiveScaleService.getScales(athleteRecord.clubId, language, {
            domains: [SUBJECTIVE_VARIABLE_DOMAIN.SLEEP],
        });
    }
    async getSleep({ response, athlete, request }) {
        const { dateOfDay } = await getSleepSchema.validate(request.qs());
        const language = getLanguageFromRequest(request);
        const sleepScales = await this.getSleepScales(athlete.athleteid, language);
        const sleepData = await this.sleepService.getSleepData(athlete.athleteid, dateOfDay);
        return response.json(this.sleepService.buildSleepResponse(sleepData, sleepScales));
    }
    async addSleep({ response, athlete, request }) {
        const { dateOfDay } = await addSleepQuerySchema.validate(request.qs());
        const language = getLanguageFromRequest(request);
        const sleepScales = await this.getSleepScales(athlete.athleteid, language);
        if (sleepScales.length === 0) {
            return response.badRequest({ error: 'Sleep scale not configured for this club' });
        }
        const payload = await addSleepSchema.validate(request.body());
        const validationError = this.subjectiveScaleValuesService.validateSleepPayload(payload.ratings, sleepScales);
        if (validationError) {
            return response.badRequest({ error: validationError });
        }
        const sleep = await this.sleepService.addOrUpdateSleep(athlete.athleteid, dateOfDay, payload, sleepScales);
        return response.json(this.sleepService.buildSleepResponse(sleep, sleepScales));
    }
}
//# sourceMappingURL=sleeps_controller.js.map