import { Claude35SonnetService } from '#services/llm/claude_3.5_sonnet_service';
import AthleteService from '#services/athlete_service';
import ChatbotService, { isUsableAthleteDiscussion } from '#services/chatbot_service';
import ChatbotQuestionsService from '#services/chatbot_questions_service';
import ChatbotReportService from '#services/chatbot_report_service';
import AgentService, { createDbTool } from '#services/agent_service';
import { vannaGateClearPending, vannaGateClosePendingWithNextUserMessage, vannaGateStorePending, } from '#services/vanna_training_gate';
import { isFeedbackOrCorrectionPrompt } from '#services/vanna_prompt_utils';
import { clearCanonicalPrompt, getCanonicalPrompt, updateCanonicalPrompt, } from '#services/vanna_canonical_store';
import { classifyQuestion } from '#services/question_router';
import { schema, validator } from '@adonisjs/validator';
import Prompt from '#models_pg/prompt';
import { chatbotSchema, getQuestionsQuerySchema, getReportQuerySchema, generateDailyReportsSchema } from '#schemas/chatbot';
import { INSIGHT_CATEGORIES } from '#constants/insight.constants';
import Athlete from '#models_pg/athlete';
import { getLanguageFromRequest } from '../utils/language.js';
import { toFrontendCharts, chartsFromStored } from '../utils/chart.js';
import { tryParseJsonResponse } from '../utils/chatbot_result.js';
import PromptService from '#services/prompt_service';
import { APP_LANGUAGES } from '#utils/localize';
import DemoMatchService from '#services/demo_match_service';
import { isChatbotMlClub } from '#constants/chatbot.constants';
export default class ChatbotsController {
    athleteService;
    chatbotService;
    chatbotQuestionsService;
    chatbotReportService;
    claude35SonnetService;
    agentService;
    promptService;
    demoMatchService;
    controllerInstanceId = Math.random().toString(36).slice(2, 10);
    constructor() {
        this.athleteService = new AthleteService();
        this.chatbotService = new ChatbotService();
        this.chatbotQuestionsService = new ChatbotQuestionsService();
        this.chatbotReportService = new ChatbotReportService();
        this.claude35SonnetService = new Claude35SonnetService();
        this.agentService = new AgentService();
        this.promptService = new PromptService();
        this.demoMatchService = new DemoMatchService();
    }
    async generateResponse({ response, request, auth }) {
        const { athleteId, date, discussionId, prompt, category } = await chatbotSchema.validate(request.body());
        const language = getLanguageFromRequest(request);
        const demoMode = request.header('x-demo-mode') === 'true';
        const existingDiscussion = discussionId
            ? await this.chatbotService.getDiscussion(discussionId, athleteId)
            : null;
        if (discussionId && !existingDiscussion) {
            return response.status(404).send({ error: 'Discussion non trouvée' });
        }
        if (existingDiscussion &&
            (existingDiscussion.userId !== auth.user.id ||
                !isUsableAthleteDiscussion(existingDiscussion, category))) {
            return response.status(404).send({ error: 'Discussion non trouvée' });
        }
        let currentDiscussionId = discussionId;
        let resolvedDiscussion = existingDiscussion;
        if (!currentDiscussionId) {
            const todayDiscussion = await this.chatbotService.findDiscussionForDay(auth.user.id, athleteId, date, category);
            if (todayDiscussion) {
                currentDiscussionId = todayDiscussion.id;
                resolvedDiscussion = todayDiscussion;
            }
            else {
                const title = await this.generateDiscussionTitle(prompt);
                const discussion = await this.chatbotService.createDiscussion({
                    userId: auth.user.id,
                    dayId: date,
                    title,
                    athleteId,
                    category,
                });
                currentDiscussionId = discussion.id;
            }
        }
        const currentCanonical = getCanonicalPrompt(currentDiscussionId);
        const canonicalPrompt = updateCanonicalPrompt(currentDiscussionId, prompt);
        if (process.env.VANNA_GATE_DEBUG === 'true') {
            console.log(`[VANNA_GATE][controller:${this.controllerInstanceId}] canonical`, JSON.stringify({
                discussion_id: currentDiscussionId,
                prompt_preview: prompt.slice(0, 140),
                current_canonical_preview: (currentCanonical ?? '').slice(0, 140),
                canonical_preview: canonicalPrompt.slice(0, 140),
                is_feedback_or_correction: isFeedbackOrCorrectionPrompt(prompt),
            }));
        }
        vannaGateClosePendingWithNextUserMessage({
            discussionId: currentDiscussionId,
            nextUserMessage: prompt,
        });
        const history = (resolvedDiscussion?.messages ?? [])
            .filter((m) => m.content && m.content.trim().length > 0)
            .map((m) => ({
            role: (m.author === 'bot' ? 'assistant' : 'user'),
            content: m.content,
        }));
        const [athlete, routerDecision] = await Promise.all([
            this.athleteService.getAthleteWithDetails({
                athleteId,
                days: 7,
                startDate: date,
            }),
            classifyQuestion(prompt, history),
        ]);
        if (!athlete) {
            return response.status(404).send({ error: 'Athlète non trouvé' });
        }
        await this.chatbotService.addMessage(currentDiscussionId, prompt, 'user');
        const res = response.response;
        const origin = request.header('origin');
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        const sendEvent = (event, data) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };
        try {
            if (demoMode) {
                const demoMatch = await this.demoMatchService.match(prompt, date, category ?? 'performance');
                if (demoMatch) {
                    console.log(`[source: demo] score=${demoMatch.score.toFixed(2)} date=${date}`);
                    console.log(`  asked:   "${prompt}"`);
                    console.log(`  matched: "${demoMatch.matchedQuestion}"`);
                    await this.chatbotService.addMessage(currentDiscussionId, demoMatch.answer, 'bot');
                    sendEvent('done', {
                        response: demoMatch.answer,
                        questions: [],
                        discussionId: currentDiscussionId,
                        charts: chartsFromStored(demoMatch.chartData),
                        source: 'demo',
                    });
                    return;
                }
            }
            if (routerDecision.route === 'chatbot_ml') {
                const day = await this.athleteService.getDayByAthleteAndDate(athleteId, date);
                const dataPrompt = await this.chatbotService.getFinalDataPrompt({
                    athlete,
                    date,
                    category: category ?? 'performance',
                    language,
                    dayId: day?.id,
                });
                const systemPromptTitle = isChatbotMlClub(athlete.clubId)
                    ? 'chatbot-ml'
                    : 'chatbot-analytics';
                const chatbotSystemPrompt = await Prompt.findBy('title', systemPromptTitle);
                const chatbotSystemFoodPrompt = await Prompt.findBy('title', 'chatbot-food');
                if (!chatbotSystemPrompt || !chatbotSystemFoodPrompt) {
                    throw new Error(`Prompt ${systemPromptTitle} non trouvé`);
                }
                const headerVariables = {
                    date,
                    category,
                    opposite_category: category === 'performance' ? 'injury' : 'performance',
                    recommendation_mode: 'auto',
                    language: language === APP_LANGUAGES.FR ? 'french' : 'english',
                };
                const baseSystemPrompt = this.promptService.replaceVariables(chatbotSystemPrompt.content, headerVariables);
                const systemPrompt = isChatbotMlClub(athlete.clubId)
                    ? baseSystemPrompt
                    : `${baseSystemPrompt}\n${chatbotSystemFoodPrompt.content}`;
                const t0 = Date.now();
                const { raw, extractedResponse } = await this.claude35SonnetService.generateResponseStream({
                    systemPrompt,
                    dataPrompt,
                    prompt: `Réponds en ${language}. ${prompt}`,
                    history,
                }, (token) => sendEvent('token', { token }));
                console.log(`[chatbot_ml][timing] ${Date.now() - t0}ms`);
                const parsedResult = tryParseJsonResponse(raw);
                const botMessage = parsedResult?.response ?? extractedResponse;
                await this.chatbotService.addMessage(currentDiscussionId, botMessage, 'bot');
                sendEvent('done', {
                    response: botMessage,
                    questions: parsedResult?.questions ?? [],
                    discussionId: currentDiscussionId,
                    ...(demoMode && { demoMiss: true }),
                });
            }
            else {
                const agentContext = athlete
                    ? {
                        mode: 'athlete',
                        athleteId,
                        athleteFirstName: athlete.firstName,
                        athleteLastName: athlete.lastName,
                        referenceDate: date,
                        language,
                    }
                    : undefined;
                const successfulSqlSet = new Set();
                const successfulSql = [];
                const dbTool = await createDbTool(prompt, agentContext, (sql) => {
                    const key = sql.trim().toLowerCase();
                    if (successfulSqlSet.has(key))
                        return;
                    successfulSqlSet.add(key);
                    successfulSql.push(sql);
                }, {
                    useVannaExamples: !isFeedbackOrCorrectionPrompt(prompt),
                    vannaRetrievalQuestion: canonicalPrompt,
                });
                const agentResult = await this.agentService.run(`Réponds en ${language}. ${prompt}`, [dbTool], history, agentContext, (token) => sendEvent('token', { token }), (status) => sendEvent('status', { status }));
                const agentParsed = tryParseJsonResponse(agentResult.answer);
                const agentMessage = agentParsed?.response ?? agentResult.answer;
                await this.chatbotService.addMessage(currentDiscussionId, agentMessage, 'bot');
                if (successfulSql.length > 0) {
                    vannaGateStorePending({
                        discussionId: currentDiscussionId,
                        prompt,
                        canonicalPrompt,
                        answer: agentMessage,
                        sql: successfulSql,
                    });
                }
                sendEvent('done', {
                    response: agentMessage,
                    questions: agentParsed?.questions ?? [],
                    discussionId: currentDiscussionId,
                    charts: toFrontendCharts(agentResult.charts),
                    ...(demoMode && { demoMiss: true }),
                });
            }
        }
        catch (error) {
            console.error('[chatbot][sse] error:', error);
            sendEvent('error', { message: 'Internal server error' });
        }
        finally {
            res.end();
        }
    }
    async generateDiscussionTitle(prompt) {
        const titleSystemPrompt = await Prompt.findBy('title', 'chatbot-title');
        if (!titleSystemPrompt) {
            throw new Error('Prompt non trouvé');
        }
        return this.claude35SonnetService.generateTitle(titleSystemPrompt.content, prompt);
    }
    async deleteDiscussion({ params, response, auth }) {
        const discussionId = params.id;
        if (!discussionId || typeof discussionId !== 'string') {
            return response.badRequest({ error: 'Invalid discussion id' });
        }
        const access = await this.chatbotService.getOwnedDiscussion(discussionId, auth.user.id, 'athlete');
        if (!access.ok) {
            return response.status(access.status).send({ error: access.error });
        }
        await this.chatbotService.deleteDiscussion(discussionId);
        clearCanonicalPrompt(discussionId);
        vannaGateClearPending(discussionId);
        return response.noContent();
    }
    async getMessages({ params, response, auth }) {
        const discussionId = params.discussionId;
        if (!discussionId || typeof discussionId !== 'string') {
            return response.badRequest({ error: 'Invalid discussion id' });
        }
        const access = await this.chatbotService.getOwnedDiscussion(discussionId, auth.user.id, 'athlete');
        if (!access.ok) {
            return response.status(access.status).send({ error: access.error });
        }
        if (access.discussion.category === null) {
            return response.status(404).send({ error: 'Discussion not found' });
        }
        const messages = await this.chatbotService.getDiscussionMessages(discussionId);
        return response.ok({
            messages: messages.map((message) => this.chatbotService.serializeMessage(message)),
        });
    }
    async getDiscussions({ params, response }) {
        const athleteIdSchema = schema.create({
            athleteId: schema.string(),
        });
        const { athleteId } = await validator.validate({
            schema: athleteIdSchema,
            data: params,
        });
        const discussions = await this.chatbotService.getDiscussions(athleteId);
        return response.ok({ discussions });
    }
    async testChatbot({ response, request }) {
        const testSchema = schema.create({
            token: schema.string(),
            dataPrompt: schema.string(),
            prompt: schema.string(),
            history: schema.array().members(schema.object().members({
                role: schema.enum(['user', 'assistant']),
                content: schema.string(),
            })),
        });
        const { prompt, history, token, dataPrompt } = await validator.validate({
            schema: testSchema,
            data: request.body(),
        });
        if (token !== 'CLEM_BOGOSS') {
            return response.status(401).send({ error: 'Token invalide' });
        }
        const systemPrompt = await Prompt.findBy('title', 'chatbot-ml');
        const foodPrompt = await Prompt.findBy('title', 'chatbot-food');
        if (!systemPrompt || !foodPrompt) {
            throw new Error('Prompt non trouvé');
        }
        const result = await this.claude35SonnetService.generateResponse({
            systemPrompt: systemPrompt.content,
            dataPrompt,
            prompt,
            history: (history || []).map((message) => ({
                role: message.role,
                content: message.content,
            })),
        });
        return response.ok({ result });
    }
    async whatToCook({ response, request }) {
        const { date, prompt, athleteId } = await validator.validate({
            schema: schema.create({
                athleteId: schema.string(),
                date: schema.string(),
                prompt: schema.string(),
            }),
            data: request.qs(),
        });
        const sevenDaysMacros = await this.athleteService.getLastSevenDaysMacros(athleteId, date);
        const hackatonPrompt = await Prompt.query().where('title', 'hackaton').first();
        if (!hackatonPrompt) {
            return response.notFound({ message: 'Prompt not found' });
        }
        const result = await this.claude35SonnetService.generateResponse({
            systemPrompt: hackatonPrompt.content,
            dataPrompt: JSON.stringify(sevenDaysMacros),
            prompt,
            history: [],
        });
        return response.json(result);
    }
    async getQuestions({ request, response, auth }) {
        const { type, category, limit } = await getQuestionsQuerySchema.validate(request.qs());
        const clubId = auth.user.clubId;
        const language = getLanguageFromRequest(request);
        try {
            const questions = await this.chatbotQuestionsService.getQuestions(clubId, type, category, limit, language);
            return response.ok({ questions });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('category is required')) {
                return response.badRequest({ error: error.message });
            }
            return response.status(500).send({ error: 'Failed to fetch questions' });
        }
    }
    async getReport({ request, response }) {
        const { athleteId, date, category } = await getReportQuerySchema.validate(request.qs());
        try {
            const day = await this.athleteService.getDayByAthleteAndDate(athleteId, date);
            if (!day) {
                return response.notFound({ error: 'Day not found for the given date and athlete' });
            }
            const report = await this.chatbotReportService.getReport(day.id, category);
            if (!report) {
                return response.ok({
                    report: null,
                });
            }
            return response.ok({
                report: report.serialize(),
            });
        }
        catch (error) {
            console.error('Error fetching chatbot report:', error);
            return response.status(500).send({ error: 'Failed to fetch report' });
        }
    }
    async generateDailyReports({ request, response }) {
        const { athleteId, date } = await generateDailyReportsSchema.validate(request.body());
        try {
            const day = await this.athleteService.getDayByAthleteAndDate(athleteId, date);
            if (!day) {
                return response.notFound({ error: 'Day not found for the given date and athlete' });
            }
            const athlete = await Athlete.query().where('id', athleteId).first();
            if (!athlete) {
                return response.notFound({ error: 'Athlete not found' });
            }
            if (!isChatbotMlClub(athlete.clubId)) {
                return response.badRequest({
                    error: 'Daily report generation is only available for ML clubs',
                });
            }
            const generated = await this.chatbotReportService.generateReportsWithSharedCache(athlete, day, date, [...INSIGHT_CATEGORIES], { force: true });
            return response.ok({
                generated,
                skipped: INSIGHT_CATEGORIES.filter((category) => !generated.includes(category)),
            });
        }
        catch (error) {
            console.error('Error generating chatbot daily reports:', error);
            return response.status(500).send({ error: 'Failed to generate daily reports' });
        }
    }
}
//# sourceMappingURL=chatbots_controller.js.map