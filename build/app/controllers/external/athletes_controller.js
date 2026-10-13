import ExternalAthleteService from '#services/external_athlete_service';
export default class ExternalAthletesController {
    athleteService;
    constructor(athleteService = new ExternalAthleteService()) {
        this.athleteService = athleteService;
    }
    async index({ response, externalApiKey }) {
        const athletes = await this.athleteService.listByClub(externalApiKey.clubId);
        return response.json({ data: athletes });
    }
}
//# sourceMappingURL=athletes_controller.js.map