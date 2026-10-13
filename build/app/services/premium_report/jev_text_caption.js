import logger from '@adonisjs/core/services/logger';
import { PREMIUM_DOMAIN_NOUL_THRESHOLD } from '#constants/premium_report_domains';
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants';
import JevService, { noul } from '#services/jev_service';
const CAPTION_ANSWER_KEY = 'needsCaption';
const PREMIUM_TEXT_CAPTION_JEV = {
    question: 'Does `caption` add non-redundant, evidence-backed staff insight for `request`, given `nearbyTitle` and `canvasSummary`? Reject filler, restating the chart title, generic coaching advice with no data, or markdown fluff.',
    trueLabel: 'Useful caption for the canvas',
    falseLabel: 'Skip — chart/table is enough or caption is filler',
};
const nearbyLabel = (block) => {
    if (!block)
        return '';
    if (block.type === 'heading' || block.type === 'text')
        return block.text.slice(0, 120);
    if (block.type === 'chart')
        return block.title.slice(0, 120);
    if (block.type === 'table')
        return (block.title ?? '').slice(0, 120);
    return '';
};
const canvasSummary = (blocks) => {
    const parts = [];
    for (const block of blocks.slice(-8)) {
        if (block.type === 'chart')
            parts.push(`chart:${block.title}`);
        else if (block.type === 'table')
            parts.push(`table:${block.title ?? ''}`);
        else if (block.type === 'heading')
            parts.push(`h:${block.text.slice(0, 60)}`);
    }
    return parts.join(' | ').slice(0, 400);
};
export const jevTextCaption = async (args) => {
    const caption = args.caption.trim();
    if (caption.length < 12)
        return { allow: false, score: 0 };
    const client = JevService.getClient();
    if (!client)
        return { allow: true, score: 1 };
    const anchorId = args.afterId || args.lastInsertedId;
    const nearby = anchorId
        ? args.blocks.find((block) => block.id === anchorId)
        : args.blocks[args.blocks.length - 1];
    try {
        const response = await client.systemOne({
            model: JEV_ROUTER_MODEL,
            state: {
                request: args.request.slice(0, 500),
                caption: caption.slice(0, 800),
                nearbyTitle: nearbyLabel(nearby),
                canvasSummary: canvasSummary(args.blocks),
            },
            questions: {
                [CAPTION_ANSWER_KEY]: noul(PREMIUM_TEXT_CAPTION_JEV.question, {
                    true: PREMIUM_TEXT_CAPTION_JEV.trueLabel,
                    false: PREMIUM_TEXT_CAPTION_JEV.falseLabel,
                }),
            },
        });
        const score = response.answers[CAPTION_ANSWER_KEY]?.noul ?? 0;
        const allow = score >= PREMIUM_DOMAIN_NOUL_THRESHOLD;
        return { allow, score };
    }
    catch (error) {
        logger.warn({ err: error }, 'premium_report.text_caption_jev_failed');
        return { allow: true, score: 1 };
    }
};
//# sourceMappingURL=jev_text_caption.js.map