import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import ChatbotDiscussion from '#models/chatbot_discussion'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { IChartSpec } from '#contracts/chatbot'

export default class ChatbotMessage extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare content: string

  @column()
  declare type: 'user' | 'bot'

  @column({
    consume: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
    prepare: (v) => (v ? JSON.stringify(v) : null),
  })
  declare chartData: IChartSpec | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @column()
  declare chatbotDiscussionId: number

  @belongsTo(() => ChatbotDiscussion)
  declare chatbotDiscussion: BelongsTo<typeof ChatbotDiscussion>
}