import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Notification from '#models/notification'
import NotificationMessage from '#models/notification_message'

export default class NotificationMessageLinks extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare notificationId: number

  @column()
  declare messageId: number

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
