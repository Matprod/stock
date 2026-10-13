import type {
  ChatbotQuestionCategory,
  ChatbotQuestionType,
} from '#constants/chatbot_questions.constants'
import { CHATBOT_QUESTION_TYPE } from '#constants/chatbot_questions.constants'
import {
  TRANSLATABLE_TYPES,
  TRANSLATION_KEYS,
} from '#constants/translation.constants'
import type { AppLanguage } from '#utils/localize'
import ChatbotQuestions from '#models_pg/chatbot_questions'
import { TranslationService } from '#services/translation_service'
import { shuffleArray } from '../utils/array.js'
import type { FormattedQuestion } from '#contracts/chatbot'

export default class ChatbotQuestionsService {
  private translationService: TranslationService

  constructor() {
    this.translationService = new TranslationService()
  }

  public async getQuestionsByClub(
    clubId: string,
    category: ChatbotQuestionCategory,
    limit: number = 4,
    language: AppLanguage
  ): Promise<FormattedQuestion[]> {
    const questions = await this.getAthleteQuestionPool(clubId, category)
    return this.formatQuestions(questions, limit, language)
  }

  public async getTeamQuestions(
    clubId: string,
    limit: number = 4,
    language: AppLanguage
  ): Promise<FormattedQuestion[]> {
    const questions = await this.getTeamQuestionPool(clubId)
    return this.formatQuestions(questions, limit, language)
  }

  public async getQuestions(
    clubId: string,
    type: ChatbotQuestionType = CHATBOT_QUESTION_TYPE.ATHLETE,
    category: ChatbotQuestionCategory | undefined,
    limit: number = 4,
    language: AppLanguage
  ): Promise<FormattedQuestion[]> {
    if (type === CHATBOT_QUESTION_TYPE.TEAM) {
      return this.getTeamQuestions(clubId, limit, language)
    }

    if (!category) {
      throw new Error('category is required for athlete questions')
    }

    return this.getQuestionsByClub(clubId, category, limit, language)
  }

  private async getAthleteQuestionPool(
    clubId: string | null,
    category: ChatbotQuestionCategory
  ): Promise<ChatbotQuestions[]> {
    const clubQuestions = await ChatbotQuestions.query()
      .where('author', CHATBOT_QUESTION_TYPE.ATHLETE)
      .where('category', category)
      .if(clubId, (query) => query.where('clubId', clubId!))
      .if(!clubId, (query) => query.whereNull('clubId'))

    if (!clubId || clubQuestions.length > 0) {
      return clubQuestions
    }

    return ChatbotQuestions.query()
      .where('author', CHATBOT_QUESTION_TYPE.ATHLETE)
      .where('category', category)
      .whereNull('clubId')
  }

  private async getTeamQuestionPool(clubId: string | null): Promise<ChatbotQuestions[]> {
    const clubQuestions = await ChatbotQuestions.query()
      .where('author', CHATBOT_QUESTION_TYPE.TEAM)
      .if(clubId, (query) => query.where('clubId', clubId!))
      .if(!clubId, (query) => query.whereNull('clubId'))

    if (!clubId || clubQuestions.length > 0) {
      return clubQuestions
    }

    return ChatbotQuestions.query().where('author', CHATBOT_QUESTION_TYPE.TEAM).whereNull('clubId')
  }

  private async formatQuestions(
    questions: ChatbotQuestions[],
    limit: number,
    language: AppLanguage
  ): Promise<FormattedQuestion[]> {
    const selectedQuestions = this.selectAndOrderQuestions(questions, limit)

    const questionIds = selectedQuestions.map((q) => q.id)
    const [titleMap, textMap] = await Promise.all([
      this.translationService.getTranslations(
        TRANSLATABLE_TYPES.CHATBOT_QUESTION,
        TRANSLATION_KEYS.CHATBOT_QUESTION_TITLE,
        questionIds,
        language
      ),
      this.translationService.getTranslations(
        TRANSLATABLE_TYPES.CHATBOT_QUESTION,
        TRANSLATION_KEYS.CHATBOT_QUESTION_TEXT,
        questionIds,
        language
      ),
    ])
    return selectedQuestions.map((q) => ({
      id: q.id,
      question: textMap.get(q.id) ?? q.question,
      title: titleMap.get(q.id) ?? q.title,
      category: q.category,
    }))
  }

  private selectAndOrderQuestions(
    questions: ChatbotQuestions[],
    limit: number
  ): ChatbotQuestions[] {
    const questionsWithOrder = questions
      .filter((q) => q.order && q.order > 0)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    const questionsWithoutOrder = questions.filter((q) => !q.order || q.order <= 0)
    shuffleArray(questionsWithoutOrder)

    return [...questionsWithOrder, ...questionsWithoutOrder].slice(0, limit)
  }
}
