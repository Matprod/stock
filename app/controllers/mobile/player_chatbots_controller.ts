import type { HttpContext } from '@adonisjs/core/http'
import PlayerChatbotService from '#services/player_chatbot_service'
import ChatbotService from '#services/chatbot_service'
import { playerChatbotSchema } from '#schemas/player_chatbot'
import AthleteService from '#services/athlete_service'

export default class MobilePlayerChatbotsController {
  private chatbotService: ChatbotService
  private playerChatbotService: PlayerChatbotService
  private athleteService: AthleteService

  constructor() {
    this.chatbotService = new ChatbotService()
    this.playerChatbotService = new PlayerChatbotService()
    this.athleteService = new AthleteService()
  }

  public async generateResponse({ request, response, athlete }: HttpContext) {
    try {
      const { date, discussionId, prompt, athlete_id } = await playerChatbotSchema.validate(
        request.body()
      )

      const athleteId = athlete_id || athlete!.athleteid

      const result = await this.playerChatbotService.generateResponse({
        prompt,
        date,
        discussionId,
        athleteId,
      })

      response.header('Content-Type', 'application/json; charset=utf-8')
      return response.json({
        response: result.response,
        discussionId: result.discussionId,
        questions: result.questions,
        classified: result.classified,
      })
    } catch (error) {
      console.error('Error in mobile generateResponse:', error)
      response.header('Content-Type', 'application/json; charset=utf-8')
      if (error instanceof Error && error.message === 'Athlète non trouvé') {
        return response.notFound({ message: 'Athlète non trouvé' })
      }
      return response.internalServerError({
        message: 'Une erreur est survenue lors de la génération de la réponse',
      })
    }
  }

  public async getDiscussions({ response, athlete }: HttpContext) {
    try {
      const athleteId = athlete!.athleteid
      const discussions = await this.chatbotService.getPlayerDiscussions(athleteId)

      response.header('Content-Type', 'application/json; charset=utf-8')
      return response.json({
        discussions: discussions.map((discussion) => ({
          id: discussion.id,
          title: discussion.title,
          createdAt: discussion.createdAt,
          updatedAt: discussion.updatedAt,
          category: 'performance',
          lastMessage: discussion.messages[discussion.messages.length - 1]?.content || '',
        })),
      })
    } catch (error) {
      console.error('Error fetching mobile discussions:', error)
      response.header('Content-Type', 'application/json; charset=utf-8')
      return response.internalServerError({ message: 'Failed to fetch discussions' })
    }
  }

  public async getMessages({ response, params }: HttpContext) {
    const { discussionId } = params

    try {
      const discussion = await this.chatbotService.getDiscussion(discussionId)

      if (!discussion) {
        response.header('Content-Type', 'application/json; charset=utf-8')
        return response.notFound({ message: 'Discussion not found' })
      }

      response.header('Content-Type', 'application/json; charset=utf-8')
      return response.json({
        messages: discussion.messages.map((message) => ({
          id: message.id,
          content: message.content,
          role: message.author === 'athlete' ? 'user' : message.author,
          timestamp: message.createdAt,
        })),
      })
    } catch (error) {
      console.error('Error fetching mobile messages:', error)
      response.header('Content-Type', 'application/json; charset=utf-8')
      return response.internalServerError({ message: 'Failed to fetch messages' })
    }
  }

  public async getRecommendedQuestions({ response, athlete }: HttpContext) {
    const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
    if (!athleteRecord) {
      response.header('Content-Type', 'application/json; charset=utf-8')
      return response.notFound({ message: 'Athlete not found' })
    }
    const language = athleteRecord.appLanguageOrDefault

    const questions = [
      {
        id: 'perf-1',
        question:
          language === 'fr'
            ? 'Comment puis-je améliorer mes performances ?'
            : 'How can I improve my performance?',
        category: 'performance',
        icon: '🏃‍♂️',
      },
      {
        id: 'nutr-1',
        question:
          language === 'fr'
            ? 'Quelle est la meilleure nutrition pour mon entraînement ?'
            : 'What is the best nutrition for my training?',
        category: 'nutrition',
        icon: '🥗',
      },
      {
        id: 'sleep-1',
        question:
          language === 'fr' ? 'Comment optimiser mon sommeil ?' : 'How can I optimize my sleep?',
        category: 'sleep',
        icon: '😴',
      },
      {
        id: 'health-1',
        question:
          language === 'fr' ? 'Comment gérer ma récupération ?' : 'How can I manage my recovery?',
        category: 'health',
        icon: '💪',
      },
      {
        id: 'perf-2',
        question:
          language === 'fr'
            ? 'Quels exercices me conviennent le mieux ?'
            : 'What exercises suit me best?',
        category: 'performance',
        icon: '🏋️‍♂️',
      },
      {
        id: 'nutr-2',
        question:
          language === 'fr'
            ? "Que manger avant et après l'entraînement ?"
            : 'What to eat before and after training?',
        category: 'nutrition',
        icon: '🍎',
      },
    ]

    response.header('Content-Type', 'application/json; charset=utf-8')
    return response.json({ questions })
  }
}
