import ExternalScoreService from '#services/external_score_service';
import { getExternalScoresSchema } from '#schemas/external';
export default class ExternalScoresController {
    scoreService;
    constructor(scoreService = new ExternalScoreService()) {
        this.scoreService = scoreService;
    }
    async index({ request, response, externalApiKey }) {
        const filters = await getExternalScoresSchema.validate(request.qs());
        const result = await this.scoreService.listByClub({
            clubId: externalApiKey.clubId,
            ...filters,
        });
        return response.json(result);
    }
}
//# sourceMappingURL=scores_controller.js.map