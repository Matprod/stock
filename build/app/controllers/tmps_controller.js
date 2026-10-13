import Day from '#models_pg/day';
import { INSIGHT_CATEGORIES } from '#constants/insight.constants';
import ChatbotReportService from '#services/chatbot_report_service';
import vine from '@vinejs/vine';
const regenerateReportSchema = vine.compile(vine.object({
    athleteId: vine.string(),
    date: vine.date({ formats: ['iso8601'] }),
    category: vine.enum(INSIGHT_CATEGORIES),
}));
export default class TmpsController {
    chatbotReportService;
    constructor() {
        this.chatbotReportService = new ChatbotReportService();
    }
    async regenerateReport({ response, request }) {
        const { athleteId, date, category } = await regenerateReportSchema.validate(request.body());
        const day = await Day.query().where('athleteId', athleteId).where('dateOfDay', date).first();
        if (!day) {
            return response.status(404).send({ message: 'Day not found' });
        }
        await this.chatbotReportService.generateReportIfNeeded(athleteId, day, category === 'performance' ? day.performanceScore : day.injuryRiskScore, category, true);
        return response.json({ message: 'Report regenerated' });
    }
}
//# sourceMappingURL=tmps_controller.js.map