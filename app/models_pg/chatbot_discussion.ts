import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import ChatbotMessage from '#models_pg/chatbot_message'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models_pg/user'
import Athlete from '#models_pg/athlete'
import { PredictionType } from '#constants/insight.constants'

export default class ChatbotDiscussion extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare title: string

  @column()
  declare category: PredictionType | null

  @column.date()
  declare discussionDay: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @column()
  declare athleteId: string | null

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @column()
  declare userId: string | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => ChatbotMessage)
  declare messages: HasMany<typeof ChatbotMessage>
}
