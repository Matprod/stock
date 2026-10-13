import AgentService, { createDbTool, createTeamPartitionState, } from '#services/agent_service';
import Club from '#models_pg/club';
import Prompt from '#models_pg/prompt';
import AthleteService from '#services/athlete_service';
import ChatbotService from '#services/chatbot_service';
import { Claude35SonnetService } from '#services/llm/claude_3.5_sonnet_service';
import { teamChatbotSchema } from '#schemas/chatbot';
import { getLanguageFromRequest } from '../utils/language.js';
import { toFrontendCharts } from '../utils/chart.js';
import { tryParseJsonResponse } from '../utils/chatbot_result.js';
import { clearCanonicalPrompt } from '#services/vanna_canonical_store';
import { vannaGateClearPending } from '#services/vanna_training_gate';
export default class TeamChatbotsController {
    agentService;
    chatbotService;
    claude35SonnetService;
    athleteService;
    constructor() {
        this.agentService = new AgentService();
        this.chatbotService = new ChatbotService();
        this.claude35SonnetService = new Claude35SonnetService();
        this.athleteService = new AthleteService();
    }
    async generateResponse({ response, request, auth }) {
        const body = await teamChatbotSchema.validate(request.body());
        const { date, prompt } = body;
        const discussionId = body.discussionId ?? null;
        const language = getLanguageFromRequest(request);
        const clubId = auth.user.clubId;
        const club = await Club.find(clubId);
        if (!club) {
            return response.status(404).send({ error: 'Club not found' });
        }
        const athleteIds = await this.athleteService.getActiveAthleteIds(clubId, date);
        if (athleteIds.length === 0) {
            return response.status(404).send({ error: 'No athletes in this team' });
        }
        const existingDiscussion = discussionId
            ? await this.chatbotService.getDiscussion(discussionId)
            : null;
        if (discussionId && !existingDiscussion) {
            return response.status(404).send({ error: 'Discussion not found' });
        }
        if (existingDiscussion) {
            if (existingDiscussion.athleteId !== null) {
                return response.status(403).send({ error: 'Forbidden: not a team discussion' });
            }
            if (existingDiscussion.userId !== auth.user.id) {
                return response.status(404).send({ error: 'Discussion not found' });
            }
        }
        let currentDiscussionId = discussionId;
        let resolvedDiscussion = existingDiscussion;
        if (!currentDiscussionId) {
            const todayDiscussion = await this.chatbotService.findTeamDiscussionForDay(auth.user.id, date);
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
                    athleteId: null,
                });
                currentDiscussionId = discussion.id;
            }
        }
        const history = (resolvedDiscussion?.messages ?? [])
            .filter((m) => m.content && m.content.trim().length > 0)
            .map((m) => ({
            role: m.author === 'bot' ? 'assistant' : 'user',
            content: m.content,
        }));
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
            const agentContext = {
                mode: 'team',
                clubId,
                clubName: club.name,
                athleteIds,
                referenceDate: date,
                language,
            };
            const teamPartitionState = createTeamPartitionState();
            const dbTool = await createDbTool(prompt, agentContext, undefined, {
                useVannaExamples: false,
                teamPartitionState,
            });
            const agentResult = await this.agentService.run(`Réponds en ${language}. ${prompt}`, [dbTool], history, agentContext, (token) => sendEvent('token', { token }), (status) => sendEvent('status', { status }));
            const agentParsed = tryParseJsonResponse(agentResult.answer);
            const agentMessage = agentParsed?.response ?? agentResult.answer;
            await this.chatbotService.addMessage(currentDiscussionId, agentMessage, 'bot');
            sendEvent('done', {
                response: agentMessage,
                questions: agentParsed?.questions ?? [],
                discussionId: currentDiscussionId,
                charts: toFrontendCharts(agentResult.charts),
            });
        }
        catch (error) {
            console.error('[team-chatbot][sse] error:', error);
            sendEvent('error', { message: 'Internal server error' });
        }
        finally {
            res.end();
        }
    }
    async deleteDiscussion({ params, response, auth }) {
        const discussionId = params.id;
        if (!discussionId || typeof discussionId !== 'string') {
            return response.badRequest({ error: 'Invalid discussion id' });
        }
        const access = await this.chatbotService.getOwnedDiscussion(discussionId, auth.user.id, 'team');
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
        const access = await this.chatbotService.getOwnedDiscussion(discussionId, auth.user.id, 'team');
        if (!access.ok) {
            return response.status(access.status).send({ error: access.error });
        }
        const messages = await this.chatbotService.getDiscussionMessages(discussionId);
        return response.ok({
            messages: messages.map((message) => this.chatbotService.serializeMessage(message)),
        });
    }
    async generateDiscussionTitle(prompt) {
        const titleSystemPrompt = await Prompt.findBy('title', 'chatbot-title');
        if (!titleSystemPrompt) {
            throw new Error('Prompt non trouvé');
        }
        return this.claude35SonnetService.generateTitle(titleSystemPrompt.content, prompt);
    }
}
//# sourceMappingURL=team_chatbots_controller.js.map