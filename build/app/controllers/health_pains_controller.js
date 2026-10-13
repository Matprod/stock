import { getAllPainsSchema } from '#schemas/pain';
import { HealthPainService } from '#services/health_pain_service';
export default class HealthPainsController {
    healthPainService;
    constructor() {
        this.healthPainService = new HealthPainService();
    }
    async getAllPains({ response, auth, request }) {
        const { athleteId } = await getAllPainsSchema.validate(request.qs());
        const pains = await this.healthPainService.getAllPains({ athleteId, clubId: auth.user.clubId });
        return response.json(pains);
    }
}
//# sourceMappingURL=health_pains_controller.js.map