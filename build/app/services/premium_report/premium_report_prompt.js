import Prompt from '#models_pg/prompt';
import { PREMIUM_REPORT_PROMPT_TITLE } from '#constants/premium_report.constants';
import { PREMIUM_REPORT_PROMPT_DEFAULT, PREMIUM_REPORT_PROMPT_VERSION, } from '#constants/premium_report_prompt';
const promptVersion = (content) => {
    const match = content.match(/premium-report-prompt-v(\d+)/);
    return match ? Number(match[1]) : 0;
};
const isCurrentPrompt = (content) => promptVersion(content) >= PREMIUM_REPORT_PROMPT_VERSION;
export const loadPremiumReportPrompt = async (clubId) => {
    const clubRow = await Prompt.query()
        .where('title', PREMIUM_REPORT_PROMPT_TITLE)
        .where('clubId', clubId)
        .first();
    if (clubRow?.content.trim()) {
        if (!isCurrentPrompt(clubRow.content)) {
            clubRow.content = PREMIUM_REPORT_PROMPT_DEFAULT;
            await clubRow.save();
        }
        return clubRow.content;
    }
    const globalRow = await Prompt.query()
        .where('title', PREMIUM_REPORT_PROMPT_TITLE)
        .whereNull('clubId')
        .first();
    if (globalRow) {
        if (globalRow.content !== PREMIUM_REPORT_PROMPT_DEFAULT) {
            globalRow.content = PREMIUM_REPORT_PROMPT_DEFAULT;
            await globalRow.save();
        }
        return globalRow.content;
    }
    const created = await Prompt.create({
        title: PREMIUM_REPORT_PROMPT_TITLE,
        content: PREMIUM_REPORT_PROMPT_DEFAULT,
        clubId: null,
    });
    return created.content;
};
//# sourceMappingURL=premium_report_prompt.js.map