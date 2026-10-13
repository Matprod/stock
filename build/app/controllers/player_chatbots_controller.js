import PlayerChatbotService from '#services/player_chatbot_service';
import ChatbotService from '#services/chatbot_service';
import { playerChatbotSchema } from '#schemas/player_chatbot';
export default class PlayerChatbotsController {
    chatbotService;
    playerChatbotService;
    constructor() {
        this.chatbotService = new ChatbotService();
        this.playerChatbotService = new PlayerChatbotService();
    }
    async generateResponse({ response, request, auth }) {
        try {
            const { date, discussionId, prompt, athlete_id } = await playerChatbotSchema.validate(request.body());
            const athleteId = athlete_id;
            const userId = auth.user?.id;
            if (!athleteId) {
                throw new Error('Athlete ID is required');
            }
            if (!userId) {
                throw new Error('User ID is required');
            }
            const result = await this.playerChatbotService.generateResponse({
                prompt,
                date,
                discussionId: discussionId,
                athleteId,
                userId,
            });
            return response.header('Content-Type', 'application/json; charset=utf-8').send({
                status: 200,
                data: {
                    response: result.response,
                    discussionId: result.discussionId,
                    questions: result.questions,
                    classified: result.classified,
                },
            });
        }
        catch (error) {
            console.error('Error in generateResponse:', error);
            if (error.message === 'athlete_id requis' ||
                error.message === 'Utilisateur non authentifié') {
                return response.status(400).send({ error: error.message });
            }
            if (error.message === 'Athlète non trouvé') {
                return response.status(404).send({ error: 'Athlète non trouvé' });
            }
            return response.status(500).send({
                error: 'Une erreur est survenue lors de la génération de la réponse',
            });
        }
    }
    async getDiscussions({ response, request, auth }) {
        try {
            const athleteId = request.input('athlete_id') || auth.user?.id || 1;
            const discussions = await this.chatbotService.getPlayerDiscussions(athleteId);
            return response.header('Content-Type', 'application/json; charset=utf-8').send({
                status: 200,
                data: {
                    discussions: discussions.map((discussion) => ({
                        id: discussion.id,
                        title: discussion.title,
                        createdAt: discussion.createdAt,
                        updatedAt: discussion.updatedAt,
                        category: 'performance',
                        lastMessage: discussion.messages[discussion.messages.length - 1]?.content || '',
                    })),
                },
            });
        }
        catch (error) {
            console.error('Error fetching discussions:', error);
            return response.status(500).send({ error: 'Failed to fetch discussions' });
        }
    }
    async getMessages({ response, params }) {
        const { discussionId } = params;
        try {
            const discussion = await this.chatbotService.getDiscussion(discussionId);
            if (!discussion) {
                return response.status(404).send({ error: 'Discussion not found' });
            }
            return response.header('Content-Type', 'application/json; charset=utf-8').send({
                status: 200,
                data: {
                    messages: discussion.messages.map((message) => ({
                        id: message.id,
                        content: message.content,
                        role: message.author,
                        timestamp: message.createdAt,
                    })),
                },
            });
        }
        catch (error) {
            console.error('Error fetching messages:', error);
            return response.status(500).send({ error: 'Failed to fetch messages' });
        }
    }
    async getRecommendedQuestions({ response }) {
        const language = 'en';
        const questions = [
            {
                id: 'perf-1',
                question: language === 'fr'
                    ? 'Comment puis-je améliorer mes performances ?'
                    : 'How can I improve my performance?',
                category: 'performance',
                icon: '🏃‍♂️',
            },
            {
                id: 'nutr-1',
                question: language === 'fr'
                    ? 'Quelle est la meilleure nutrition pour mon entraînement ?'
                    : 'What is the best nutrition for my training?',
                category: 'nutrition',
                icon: '🥗',
            },
            {
                id: 'sleep-1',
                question: language === 'fr' ? 'Comment optimiser mon sommeil ?' : 'How can I optimize my sleep?',
                category: 'sleep',
                icon: '😴',
            },
            {
                id: 'health-1',
                question: language === 'fr' ? 'Comment gérer ma récupération ?' : 'How can I manage my recovery?',
                category: 'health',
                icon: '💪',
            },
            {
                id: 'perf-2',
                question: language === 'fr'
                    ? 'Quels exercices me conviennent le mieux ?'
                    : 'What exercises suit me best?',
                category: 'performance',
                icon: '🏋️‍♂️',
            },
            {
                id: 'nutr-2',
                question: language === 'fr'
                    ? "Que manger avant et après l'entraînement ?"
                    : 'What to eat before and after training?',
                category: 'nutrition',
                icon: '🍎',
            },
        ];
        return response.header('Content-Type', 'application/json; charset=utf-8').send({
            status: 200,
            data: { questions },
        });
    }
}
//# sourceMappingURL=player_chatbots_controller.js.map