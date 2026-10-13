import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import ChatbotDiscussion from '#models_pg/chatbot_discussion'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ChatbotMessageAuthor } from '#contracts/chatbot'

export default class ChatbotMessage extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare content: string

  @column()
  declare author: ChatbotMessageAuthor

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @column()
  declare chatbotDiscussionId: string

  @belongsTo(() => ChatbotDiscussion)
  declare chatbotDiscussion: BelongsTo<typeof ChatbotDiscussion>
}
