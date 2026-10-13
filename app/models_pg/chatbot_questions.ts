import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { ChatbotQuestionCategory, ChatbotQuestionType } from '#constants/chatbot_questions.constants'
import Club from '#models_pg/club'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class ChatbotQuestion extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare title: string

  @column()
  declare question: string

  @column()
  declare author: ChatbotQuestionType

  @column()
  declare category: ChatbotQuestionCategory

  @column()
  declare order: number

  @column()
  declare clubId: string

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>
}
