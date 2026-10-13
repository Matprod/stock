import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import ChatbotMessage from '#models/chatbot_message'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Athlete from '#models/athlete'
import type { PredictionType } from '#constants/insight.constants'

export default class ChatbotDiscussion extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column.date()
  declare discussionDay: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @column()
  declare athleteId: number | null

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @column()
  declare userId: number | null

  @column()
  declare category: PredictionType | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => ChatbotMessage)
  declare messages: HasMany<typeof ChatbotMessage>
}
