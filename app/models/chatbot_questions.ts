import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { ChatbotQuestionCategory, ChatbotQuestionType } from '#constants/chatbot_questions.constants'
import Club from './club.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class ChatbotQuestions extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare question: string

  @column()
  declare category: ChatbotQuestionCategory | null

  @column()
  declare type: ChatbotQuestionType

  @column()
  declare title: string

  @column()
  declare order: number

  @column()
  declare clubId: number

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>
}
