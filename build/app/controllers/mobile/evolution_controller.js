import { EvolutionService } from '#services/mobile/evolution_service';
import { getEvolutionQuerySchema } from '#schemas/mobile/evolution';
export default class EvolutionController {
    evolutionService;
    constructor() {
        this.evolutionService = new EvolutionService();
    }
    async getSleepEvolution({ response, athlete, request }) {
        const { startDate, endDate } = await getEvolutionQuerySchema.validate(request.qs());
        const evolution = await this.evolutionService.getSleepEvolution(athlete.athleteid, startDate, endDate);
        return response.json(evolution);
    }
    async getHealthEvolution({ response, athlete, request }) {
        const { startDate, endDate } = await getEvolutionQuerySchema.validate(request.qs());
        const evolution = await this.evolutionService.getHealthEvolution(athlete.athleteid, startDate, endDate);
        return response.json(evolution);
    }
    async getActivityEvolution({ response, athlete, request }) {
        const { startDate, endDate } = await getEvolutionQuerySchema.validate(request.qs());
        const evolution = await this.evolutionService.getActivityEvolution(athlete.athleteid, startDate, endDate);
        return response.json(evolution);
    }
    async getNutritionEvolution({ response, athlete, request }) {
        const { startDate, endDate } = await getEvolutionQuerySchema.validate(request.qs());
        const evolution = await this.evolutionService.getNutritionEvolution(athlete.athleteid, startDate, endDate);
        return response.json(evolution);
    }
}
//# sourceMappingURL=evolution_controller.js.map