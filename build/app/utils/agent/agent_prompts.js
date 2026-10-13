import Prompt from '#models_pg/prompt';
import Athlete from '#models_pg/athlete';
import { AGENT_PROMPT_TITLES, FORCE_ANSWER_AT, SQL_PARTITION_TARGET_CHARS, SQL_PARTITION_TARGET_ROWS, } from '#constants/agent.constants';
import { MAX_SERIES_CHARTS } from '#constants/agent_series.constants';
import { SubjectiveScaleService } from '#services/subjective_scale_service';
import ThresholdsService from '#services/thresholds_service';
import { APP_LANGUAGES } from '#utils/localize';
const subjectiveScaleService = new SubjectiveScaleService();
const thresholdsService = new ThresholdsService();
export const buildSystemPrompt = async (context, opts) => {
    if (opts?.leanSeries)
        return buildSeriesSystemPrompt(context);
    const base = await loadFilledPrompt(AGENT_PROMPT_TITLES.system);
    if (!context)
        return base;
    if (context.mode === 'athlete') {
        const [guardrails, scales, thresholds] = await Promise.all([
            loadFilledPrompt(AGENT_PROMPT_TITLES.athleteGuardrails, {
                athleteFirstName: context.athleteFirstName,
                athleteLastName: context.athleteLastName,
                athleteId: context.athleteId,
                athleteIdQuoted: quoteUuid(context.athleteId),
                referenceDate: context.referenceDate,
            }),
            loadSubjectiveScalesBlock(context),
            loadClubThresholdsBlock(context),
        ]);
        return base + guardrails + scales + thresholds;
    }
    const [partition, guardrails, scales, thresholds] = await Promise.all([
        buildSqlPartitionPromptBlock(context.referenceDate),
        loadFilledPrompt(AGENT_PROMPT_TITLES.teamGuardrails, {
            clubName: context.clubName,
            clubIdQuoted: quoteUuid(context.clubId),
            athleteIdsList: context.athleteIds.join(', '),
            firstAthleteIdQuoted: quoteUuid(context.athleteIds[0] ?? 'uuid'),
            referenceDate: context.referenceDate,
        }),
        loadSubjectiveScalesBlock(context),
        loadClubThresholdsBlock(context),
    ]);
    return base + partition + guardrails + scales + thresholds + teamRosterPrompt(context);
};
export const buildSeriesSystemPrompt = (context) => loadFilledPrompt(AGENT_PROMPT_TITLES.series, {
    maxSeriesCharts: String(MAX_SERIES_CHARTS),
    scope: buildSeriesScope(context),
});
export const buildSqlPartitionPromptBlock = (referenceDate) => loadFilledPrompt(AGENT_PROMPT_TITLES.teamSqlPartition, {
    maxQueries: String(FORCE_ANSWER_AT - 1),
    forceAnswerAt: String(FORCE_ANSWER_AT),
    targetRows: String(SQL_PARTITION_TARGET_ROWS),
    targetChars: String(SQL_PARTITION_TARGET_CHARS),
    referenceDate,
});
const quoteUuid = (id) => `'${id}'`;
const teamActiveDateFilter = (date) => `(a.end_date IS NULL OR a.end_date >= '${date}') AND a.start_date <= '${date}'`;
const resolveClubId = async (context) => {
    if (context.mode === 'team')
        return context.clubId;
    const athlete = await Athlete.query().where('id', context.athleteId).select('clubId').first();
    return athlete?.clubId ?? null;
};
const loadSubjectiveScalesBlock = async (context) => {
    const clubId = await resolveClubId(context);
    if (!clubId)
        return '';
    const block = await subjectiveScaleService.formatClubCatalogueReference(clubId, context.language ?? APP_LANGUAGES.EN);
    return block ? `\n\n${block}` : '';
};
const loadClubThresholdsBlock = async (context) => {
    const clubId = await resolveClubId(context);
    if (!clubId)
        return '';
    const [{ thresholds }, template] = await Promise.all([
        thresholdsService.getThresholdsByClubId(clubId),
        Prompt.findByOrFail('title', AGENT_PROMPT_TITLES.clubThresholds).then((p) => p.content),
    ]);
    const { injury, performance } = thresholds;
    return `\n\n${fillPromptTemplate(template, {
        injuryHigh: String(injury.high),
        injuryMedium: String(injury.medium),
        performanceHigh: String(performance.high),
        performanceMedium: String(performance.medium),
    })}`;
};
const teamRosterPrompt = (context) => `\n\nTEAM SCOPE:\nOn athletes joins always AND ${teamActiveDateFilter(context.referenceDate)}. Never mention players who left (end_date before this date).`;
const fillPromptTemplate = (template, values) => Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, value), template);
const loadFilledPrompt = async (title, values = {}) => {
    const prompt = await Prompt.findByOrFail('title', title);
    return fillPromptTemplate(prompt.content, values);
};
const buildSeriesScope = (context) => {
    if (context?.mode === 'athlete') {
        return `Athlete ${context.athleteFirstName} ${context.athleteLastName}: WHERE a.id = ${quoteUuid(context.athleteId)}. Today=${context.referenceDate}, no later dates.`;
    }
    if (context?.mode === 'team') {
        return `Team ${context.clubName}: ALWAYS a.club_id = ${quoteUuid(context.clubId)} AND ${teamActiveDateFilter(context.referenceDate)}. Today=${context.referenceDate}.
Name: TRIM+ILIKE first/last (accents). Never invent "not found" without querying. Never mention players who left.`;
    }
    return '';
};
//# sourceMappingURL=agent_prompts.js.map