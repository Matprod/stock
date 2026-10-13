import ThresholdsService from '#services/thresholds_service';
export default class ThresholdsController {
    thresholdsService;
    constructor() {
        this.thresholdsService = new ThresholdsService();
    }
    async getThresholds({ auth, response, logger }) {
        try {
            const clubId = auth.user.clubId;
            const payload = await this.thresholdsService.getThresholdsByClubId(clubId);
            return response.json(payload);
        }
        catch (error) {
            logger.error({ err: error }, 'ThresholdsController: getThresholds failed');
            return response.status(500).json({
                error: 'An internal server error occurred while retrieving thresholds.',
            });
        }
    }
}
//# sourceMappingURL=thresholds_controller.js.map