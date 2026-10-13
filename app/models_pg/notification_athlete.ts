import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Notification from '#models_pg/notification'
import Athlete from '#models_pg/athlete'

export default class NotificationAthlete extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare notificationId: string

  @column()
  declare athleteId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => Notification)
  declare notification: BelongsTo<typeof Notification>

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>
}
