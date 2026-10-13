import { addHealthQuerySchema, addHealthSchema, getHealthSchema, } from '#schemas/mobile/health';
import HealthService from '#services/mobile/health_service';
import AthleteService from '#services/athlete_service';
import { SubjectiveScaleService } from '#services/subjective_scale_service';
import { SubjectiveScaleValuesService } from '#services/subjective_scale_values_service';
import { getLanguageFromRequest } from '#utils/language';
export default class HealthController {
    healthService;
    athleteService;
    subjectiveScaleService;
    subjectiveScaleValuesService;
    constructor() {
        this.healthService = new HealthService();
        this.athleteService = new AthleteService();
        this.subjectiveScaleService = new SubjectiveScaleService();
        this.subjectiveScaleValuesService = new SubjectiveScaleValuesService();
    }
    async getClubScales(athleteId, language) {
        const athleteRecord = await this.athleteService.getAthleteById(athleteId);
        if (!athleteRecord?.clubId) {
            return [];
        }
        return await this.subjectiveScaleService.getScales(athleteRecord.clubId, language);
    }
    async getHealth({ response, athlete, request }) {
        const { dateOfDay } = await getHealthSchema.validate(request.qs());
        const language = getLanguageFromRequest(request);
        const clubScales = await this.getClubScales(athlete.athleteid, language);
        const health = await this.healthService.getHealth(athlete.athleteid, dateOfDay);
        if (!health) {
            return response.json(null);
        }
        await this.healthService.translatePainLocations(health.pains.map((pain) => pain.location), language);
        return response.json(await this.healthService.buildHealthResponse(health, clubScales));
    }
    async addHealth({ response, athlete, request }) {
        const { dateOfDay } = await addHealthQuerySchema.validate(request.qs());
        const language = getLanguageFromRequest(request);
        const clubScales = await this.getClubScales(athlete.athleteid, language);
        const payload = await addHealthSchema.validate(request.body());
        const validationError = this.subjectiveScaleValuesService.validateHealthPayload({ ratings: payload.ratings, metrics: payload.metrics }, clubScales);
        if (validationError) {
            return response.badRequest({ error: validationError });
        }
        const health = await this.healthService.addOrUpdateHealth(athlete.athleteid, dateOfDay, {
            pains: payload.pains,
            ratings: payload.ratings,
            metrics: payload.metrics,
            clubScales,
        });
        await this.healthService.translatePainLocations(health.pains.map((pain) => pain.location), language);
        return response.json(await this.healthService.buildHealthResponse(health, clubScales));
    }
    async getDiscomfortLocations({ response, athlete, request }) {
        const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
        if (!athleteRecord) {
            return response.notFound({ message: 'Athlete not found' });
        }
        const language = getLanguageFromRequest(request);
        const discomfortLocations = await this.healthService.getDiscomfortLocations(language);
        return response.json(discomfortLocations.map((discomfortLocation) => discomfortLocation.serialize()));
    }
    async getHealthUtilities({ response, athlete, request }) {
        const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
        if (!athleteRecord) {
            return response.notFound({ message: 'Athlete not found' });
        }
        const language = getLanguageFromRequest(request);
        const { painLocations } = await this.healthService.getUtilities(athlete.athleteid, language);
        return response.json(painLocations.map((location) => location.serialize()));
    }
}
//# sourceMappingURL=health_controller.js.map