import { premiumReportGenerateSchema, premiumReportPdfSchema } from '#schemas/premium_report';
import PremiumReportService from '#services/premium_report_service';
import { getLanguageFromRequest } from '#utils/language';
const sendPdf = (response, file) => {
    const filename = file.filename.replace(/["\\\r\n]/g, '_');
    return response
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(file.buffer);
};
export default class PremiumReportController {
    premiumReportService = new PremiumReportService();
    async generate({ request, response, auth }) {
        const payload = await premiumReportGenerateSchema.validate(request.body());
        const language = getLanguageFromRequest(request);
        const result = await this.premiumReportService.generate(auth.user.clubId, payload, language);
        return response.ok(result);
    }
    async exportPdf({ request, response, auth }) {
        const payload = await premiumReportPdfSchema.validate(request.body());
        const language = getLanguageFromRequest(request);
        const file = await this.premiumReportService.exportPdf(auth.user.clubId, payload.document, language);
        return sendPdf(response, file);
    }
}
//# sourceMappingURL=premium_report_controller.js.map