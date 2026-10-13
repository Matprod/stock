import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Club from '#models_pg/club'
import NotificationMessage from '#models_pg/notification_message'
import Athlete from '#models_pg/athlete'
import type { Day } from '#constants/days.constants'

export default class Notification extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare title: string

  @column.date()
  declare date: DateTime | null

  @column()
  declare day: Day | null

  @column()
  declare time: string

  @column()
  declare clubId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @manyToMany(() => NotificationMessage, {
    pivotTable: 'notification_message_links',
  })
  declare messages: ManyToMany<typeof NotificationMessage>

  @manyToMany(() => Athlete, {
    pivotTable: 'notification_athletes',
  })
  declare athletes: ManyToMany<typeof Athlete>
}
