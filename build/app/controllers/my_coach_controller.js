import { MyCoachService } from '#services/my_coach_service';
export default class MyCoachController {
    myCoachService;
    constructor() {
        this.myCoachService = new MyCoachService();
    }
    async getAnalysisVariables({ request, response }) {
        try {
            const { playerId, isFetchPast } = request.body();
            const data = await this.myCoachService.fetchPlayerDataByTimeRange(isFetchPast === 'true', playerId);
            return response.json(data);
        }
        catch (error) {
            return response.status(500).json({
                success: false,
                message: 'Failed to fetch MyCoach data',
                error: error.message
            });
        }
    }
}
//# sourceMappingURL=my_coach_controller.js.map