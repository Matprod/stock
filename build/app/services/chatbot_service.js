import ChatbotDiscussion from '#models_pg/chatbot_discussion';
import ChatbotMessage from '#models_pg/chatbot_message';
import ChatbotReport from '#models_pg/chatbot_report';
import FeatureFormatterService from '#services/feature_formatter_service';
import Insight from '#models_pg/insight';
import AthleteService from '#services/athlete_service';
import { CHATBOT_FILTERED_PERIOD_METRICS, isHamburgClub, isChatbotMlClub, isSunderlandClub, } from '#constants/chatbot.constants';
import PromptService from '#services/prompt_service';
import { postProcessMetric } from '../utils/metric_utils.js';
import { DateTime } from 'luxon';
import { SubjectiveScaleService } from '#services/subjective_scale_service';
import { APP_LANGUAGES } from '#utils/localize';
const CHATBOT_DISCUSSION_TITLE_MAX_LENGTH = 255;
const parseDiscussionDay = (dayId) => {
    const raw = dayId?.trim() ?? '';
    const candidates = [
        DateTime.fromISO(raw),
        DateTime.fromFormat(raw, 'yyyy-MM-dd'),
        DateTime.fromFormat(raw.slice(0, 10), 'yyyy-MM-dd'),
    ];
    for (const dt of candidates) {
        if (dt.isValid)
            return dt.startOf('day');
    }
    throw new Error(`Invalid discussion day "${dayId}" — expected yyyy-MM-dd or ISO date`);
};
export function isUsableAthleteDiscussion(discussion, category) {
    const storedCategory = discussion.category;
    if (storedCategory === null || storedCategory !== category) {
        return false;
    }
    return true;
}
function normalizeDiscussionTitle(raw) {
    const normalized = raw
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const base = normalized.length > 0 ? normalized : 'Conversation';
    if (base.length <= CHATBOT_DISCUSSION_TITLE_MAX_LENGTH)
        return base;
    return base.slice(0, CHATBOT_DISCUSSION_TITLE_MAX_LENGTH).trimEnd();
}
export default class ChatbotService {
    featureFormatterService;
    athleteService;
    promptService;
    subjectiveScaleService;
    constructor() {
        this.featureFormatterService = new FeatureFormatterService();
        this.athleteService = new AthleteService();
        this.promptService = new PromptService();
        this.subjectiveScaleService = new SubjectiveScaleService();
    }
    async getFinalDataPrompt(request) {
        const { athlete, category, nutrition, date } = request;
        const language = request.language ?? athlete.appLanguageOrDefault ?? APP_LANGUAGES.FR;
        const subjectiveScaleByFieldName = await this.subjectiveScaleService.getClubCatalogueMap(athlete.clubId, language);
        const subjectiveScalesString = await this.subjectiveScaleService.formatClubCatalogueReference(athlete.clubId, language);
        if (isSunderlandClub(athlete.clubId) || isHamburgClub(athlete.clubId)) {
            const mlClubPrompt = await this.promptService.getFinalDataPrompt({
                athleteId: athlete.id,
                date,
                category,
                language: request.language,
            });
            return subjectiveScalesString
                ? `${mlClubPrompt}\n\n${subjectiveScalesString}`
                : mlClubPrompt;
        }
        await this.athleteService.enrichActivitiesWithZones(athlete);
        const weekInsights = new Set(athlete.days
            .filter((day) => day.dateOfDay?.toFormat('yyyy-MM-dd') !== date)
            .flatMap((day) => day.featureImportances)
            .filter((feature) => feature.value !== feature.optimal)
            .filter((feature) => feature.category === category)
            .map((featureImportance) => {
            return featureImportance.insight.variableName;
        }));
        const filteredMetricsSet = new Set(CHATBOT_FILTERED_PERIOD_METRICS);
        const weekMetrics = Array.from(new Set(athlete.days
            .filter((day) => day.dateOfDay?.toFormat('yyyy-MM-dd') !== date)
            .flatMap((day) => day.sportActivities)
            .flatMap((activity) => activity.periods)
            .flatMap((period) => period.metricValues)
            .filter((metricValue) => !filteredMetricsSet.has(metricValue.metric.name))
            .map((metricValue) => {
            const processed = postProcessMetric({
                name: metricValue.metric.name,
                value: metricValue.value,
                unit: metricValue.metric.unit,
            });
            return `${metricValue.metric.description} : ${processed.value} ${processed.unit ? `(unité : ${processed.unit})` : ''}`;
        })));
        const insights = await Insight.all();
        const cleanedInsights = this.featureFormatterService.cleanInsightsForLLM(insights, weekInsights);
        const cleanedAthlete = this.featureFormatterService.cleanAthleteForLLM(athlete, undefined, date, subjectiveScaleByFieldName);
        const cleanedNutrition = nutrition
            ? await this.featureFormatterService.cleanNutritionForLLM(athlete, date, nutrition, true)
            : '';
        let reportString;
        if (request.dayId !== undefined) {
            const latestReport = await ChatbotReport.latestForDay(request.dayId, category);
            if (latestReport?.message) {
                reportString = latestReport.message;
            }
        }
        const finalDataPrompt = this.featureFormatterService.getFinalDataPrompt({
            date,
            athleteString: cleanedAthlete,
            category,
            nutritionString: cleanedNutrition,
            featuresString: await this.featureFormatterService.cleanFeaturesDayForLLM(insights, athlete, category, date),
            insightsString: cleanedInsights,
            metricsString: weekMetrics.join('\n'),
            reportString,
            subjectiveScalesString,
        });
        return finalDataPrompt;
    }
    async getSharedReportDataPrompt(request) {
        const { athlete, date, language } = request;
        if (!isChatbotMlClub(athlete.clubId)) {
            throw new Error('Shared report data prompt is only supported for ML clubs (Sunderland/Hamburg)');
        }
        const lang = language ?? athlete.appLanguageOrDefault ?? APP_LANGUAGES.FR;
        const mlClubPrompt = await this.promptService.getSharedReportDataPrompt({
            athleteId: athlete.id,
            date,
            language: lang,
        });
        const subjectiveScalesString = await this.subjectiveScaleService.formatClubCatalogueReference(athlete.clubId, lang);
        return subjectiveScalesString ? `${mlClubPrompt}\n\n${subjectiveScalesString}` : mlClubPrompt;
    }
    async createDiscussion({ userId, dayId, title, athleteId, category, }) {
        const normalizedTitle = normalizeDiscussionTitle(title);
        const discussionDay = parseDiscussionDay(dayId);
        if (athleteId == null) {
            return ChatbotDiscussion.create({
                userId,
                discussionDay,
                title: normalizedTitle,
                athleteId: null,
                category: null,
            });
        }
        return ChatbotDiscussion.create({
            userId,
            discussionDay,
            title: normalizedTitle,
            athleteId,
            category: category ?? null,
        });
    }
    async getDiscussion(discussionId, athleteId) {
        const query = ChatbotDiscussion.query()
            .where('id', discussionId)
            .preload('messages', (messagesQuery) => {
            messagesQuery.orderBy('createdAt', 'asc');
        });
        if (athleteId !== undefined) {
            query.where('athleteId', athleteId);
        }
        return query.first();
    }
    async getOwnedDiscussion(discussionId, userId, kind) {
        const discussion = await ChatbotDiscussion.query().where('id', discussionId).first();
        if (!discussion) {
            return {
                ok: false,
                status: 404,
                error: 'Discussion not found',
            };
        }
        if (discussion.userId !== userId) {
            return {
                ok: false,
                status: 404,
                error: 'Discussion not found',
            };
        }
        if (kind === 'athlete' && discussion.athleteId === null) {
            return { ok: false, status: 403, error: 'Forbidden: not an athlete discussion' };
        }
        if (kind === 'team' && discussion.athleteId !== null) {
            return { ok: false, status: 403, error: 'Forbidden: not a team discussion' };
        }
        return { ok: true, discussion };
    }
    async getDiscussionMessages(discussionId) {
        return ChatbotMessage.query()
            .where('chatbotDiscussionId', discussionId)
            .orderBy('createdAt', 'asc');
    }
    serializeMessage(message) {
        return {
            id: message.id,
            author: message.author,
            content: message.content,
            createdAt: message.createdAt.toISO(),
        };
    }
    async addMessage(chatbotDiscussionId, content, author) {
        let resolvedAuthor;
        switch (author) {
            case 'user':
                resolvedAuthor = 'staff';
                break;
            case 'bot':
                resolvedAuthor = 'bot';
                break;
            default:
                resolvedAuthor = author;
                break;
        }
        return ChatbotMessage.create({
            chatbotDiscussionId,
            content,
            author: resolvedAuthor,
        });
    }
    async getDiscussions(athleteId) {
        return ChatbotDiscussion.query()
            .preload('messages')
            .where('athleteId', athleteId)
            .orderBy('updatedAt', 'desc');
    }
    async getPlayerDiscussions(athleteId) {
        return ChatbotDiscussion.query()
            .preload('messages')
            .where('athleteId', athleteId)
            .orderBy('updatedAt', 'desc');
    }
    async getTeamDiscussions(userId) {
        return ChatbotDiscussion.query()
            .preload('messages')
            .where('userId', userId)
            .whereNull('athleteId')
            .orderBy('updatedAt', 'desc');
    }
    async findDiscussionForDay(userId, athleteId, day, category) {
        return ChatbotDiscussion.query()
            .where('userId', userId)
            .where('athleteId', athleteId)
            .where('discussionDay', day)
            .where('category', category)
            .preload('messages', (messagesQuery) => {
            messagesQuery.orderBy('createdAt', 'asc');
        })
            .first();
    }
    async findTeamDiscussionForDay(userId, day) {
        return ChatbotDiscussion.query()
            .where('userId', userId)
            .whereNull('athleteId')
            .where('discussionDay', day)
            .preload('messages', (messagesQuery) => {
            messagesQuery.orderBy('createdAt', 'asc');
        })
            .first();
    }
    async deleteDiscussion(discussionId) {
        await ChatbotDiscussion.query().where('id', discussionId).delete();
    }
}
//# sourceMappingURL=chatbot_service.js.map