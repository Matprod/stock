import InjuryService from '#services/injury_service';
import SeasonService from '#services/season_service';
import { getInjuriesSchema, upsertInjuryParams, upsertInjurySchema } from '#schemas/injury';
import AthleteService from '#services/athlete_service';
export default class InjuryController {
    injuryService;
    seasonService;
    athleteService;
    constructor() {
        this.injuryService = new InjuryService();
        this.seasonService = new SeasonService();
        this.athleteService = new AthleteService();
    }
    async getInjuryTypes({ response, auth, athlete }) {
        if (athlete) {
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord) {
                return response.notFound({ message: 'Athlete not found' });
            }
            const injuryTypes = await this.injuryService.getInjuryTypes(athleteRecord.clubId);
            return response.json(injuryTypes.map((injuryType) => injuryType.serialize()));
        }
        const injuryTypes = await this.injuryService.getInjuryTypes(auth.user.clubId);
        return response.json(injuryTypes);
    }
    async getAll({ response, auth, request }) {
        const seasonInfo = await this.seasonService.getSeasonFromRequest(request, auth.user.clubId);
        const { athleteId } = await getInjuriesSchema.validate(request.qs());
        const injuries = await this.injuryService.getInjuriesByClub(auth.user.clubId, seasonInfo.seasonStartDate, seasonInfo.seasonEndDate, athleteId);
        return response.json(injuries);
    }
    async upsertInjury({ request, response, auth, params }) {
        const payload = await upsertInjurySchema.validate(request.body());
        const routeParams = await upsertInjuryParams.validate(params);
        try {
            const injury = await this.injuryService.upsertInjury({
                ...payload,
                ...routeParams,
                clubId: auth.user.clubId,
            });
            return response.json(injury);
        }
        catch (error) {
            return response.badRequest({ message: error.message });
        }
    }
    async deleteInjury({ response, auth, params }) {
        try {
            const result = await this.injuryService.deleteInjury(params.id, auth.user.clubId);
            return response.json(result);
        }
        catch (error) {
            return response.notFound({ message: error.message });
        }
    }
}
//# sourceMappingURL=injury_controller.js.map