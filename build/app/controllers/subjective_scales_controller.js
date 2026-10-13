import { SubjectiveScaleService } from '#services/subjective_scale_service';
import { getLanguageFromRequest } from '#utils/language';
export default class SubjectiveScalesController {
    subjectiveScaleService = new SubjectiveScaleService();
    async getScales({ response, auth, request }) {
        const clubId = auth.user?.clubId;
        if (!clubId) {
            return response.notFound({ error: 'Club not found' });
        }
        const language = getLanguageFromRequest(request);
        const scales = await this.subjectiveScaleService.getScales(clubId, language);
        return response.json(scales);
    }
}
//# sourceMappingURL=subjective_scales_controller.js.map