import BiomarkerService from '#services/biomarker_service';
import SeasonService from '#services/season_service';
import { biomarkerIdParams, createBiomarkersSchema, getAllBiomarkersQuerySchema, updateBiomarkerSchema, } from '#schemas/biomarker';
import { getLanguageFromRequest } from '#utils/language';
export default class BiomarkerController {
    biomarkerService;
    seasonService;
    constructor() {
        this.biomarkerService = new BiomarkerService();
        this.seasonService = new SeasonService();
    }
    async getBiomarkerTypes({ response, auth, request }) {
        const language = getLanguageFromRequest(request);
        const biomarkerTypes = await this.biomarkerService.getBiomarkerTypes(auth.user.clubId, language);
        return response.json(biomarkerTypes);
    }
    async getAll({ response, auth, request }) {
        const language = getLanguageFromRequest(request);
        const filters = await getAllBiomarkersQuerySchema.validate(request.qs());
        const seasonInfo = await this.seasonService.getSeasonFromRequest(request, auth.user.clubId);
        const biomarkers = await this.biomarkerService.getBiomarkersByClub(auth.user.clubId, language, filters, seasonInfo.seasonStartDate, seasonInfo.seasonEndDate);
        return response.ok(biomarkers);
    }
    async createBiomarkers({ request, response, auth }) {
        const biomarkers = await createBiomarkersSchema.validate(request.body());
        try {
            const result = await this.biomarkerService.createBiomarkers({
                biomarkers,
                clubId: auth.user.clubId,
            });
            return response.json(result);
        }
        catch (error) {
            return response.badRequest({
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async updateBiomarker({ request, response, auth, params }) {
        const language = getLanguageFromRequest(request);
        const payload = await updateBiomarkerSchema.validate(request.body());
        const { id } = await biomarkerIdParams.validate(params);
        try {
            const biomarker = await this.biomarkerService.updateBiomarker({
                ...payload,
                id,
                clubId: auth.user.clubId,
                language,
            });
            return response.json(biomarker);
        }
        catch (error) {
            return response.badRequest({
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async deleteBiomarker({ response, auth, params }) {
        const { id } = await biomarkerIdParams.validate(params);
        try {
            const result = await this.biomarkerService.deleteBiomarker(id, auth.user.clubId);
            return response.json(result);
        }
        catch (error) {
            return response.notFound({
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
//# sourceMappingURL=biomarker_controller.js.map