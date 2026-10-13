import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Notification from '#models_pg/notification'
import NotificationMessage from '#models_pg/notification_message'

export default class NotificationMessageLink extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare notificationId: string

  @column()
  declare notificationMessageId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => Notification)
  declare notification: BelongsTo<typeof Notification>

  @belongsTo(() => NotificationMessage)
  declare message: BelongsTo<typeof NotificationMessage>
}
