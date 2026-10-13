import DiseaseService from '#services/disease_service';
import SeasonService from '#services/season_service';
import { deleteDiseaseParams, getDiseasesSchema, upsertDiseaseParams, upsertDiseaseSchema, } from '#schemas/disease';
export default class DiseasesController {
    diseaseService;
    seasonService;
    constructor() {
        this.diseaseService = new DiseaseService();
        this.seasonService = new SeasonService();
    }
    async getAll({ response, auth, request }) {
        const seasonInfo = await this.seasonService.getSeasonFromRequest(request, auth.user.clubId);
        const { athleteId } = await getDiseasesSchema.validate(request.qs());
        const diseases = await this.diseaseService.getDiseasesByClub(auth.user.clubId, seasonInfo.seasonStartDate, seasonInfo.seasonEndDate, athleteId);
        return response.json(diseases);
    }
    async upsertDisease({ request, response, auth, params }) {
        const payload = await upsertDiseaseSchema.validate(request.body());
        const routeParams = await upsertDiseaseParams.validate(params);
        try {
            const disease = await this.diseaseService.upsertDisease({
                ...payload,
                ...routeParams,
                clubId: auth.user.clubId,
            });
            return response.json(disease);
        }
        catch (error) {
            return response.badRequest({ message: error.message });
        }
    }
    async deleteDisease({ response, auth, params }) {
        const { id } = await deleteDiseaseParams.validate(params);
        try {
            const result = await this.diseaseService.deleteDisease(id, auth.user.clubId);
            return response.json(result);
        }
        catch (error) {
            return response.notFound({ message: error.message });
        }
    }
}
//# sourceMappingURL=diseases_controller.js.map