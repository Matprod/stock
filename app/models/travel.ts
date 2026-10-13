import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Health from '#models/health'
import Event from '#models/event'

export default class Travel extends BaseModel {
  public static table = 'health_travel'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare meanOfTransport: string

  @column()
  declare duration: number

  @computed()
  get durationText(): string | null {
    console.log(this.duration)
    return this.duration ? DateTime.fromMillis(this.duration / 1000).toFormat('HH:mm') : null
  }

  @column.dateTime()
  declare dateAdded: DateTime

  @column.dateTime()
  declare dateUpdated: DateTime

  @column()
  declare eventId: number | null

  @belongsTo(() => Event, {
    foreignKey: 'eventId',
  })
  declare event: BelongsTo<typeof Event>

  // Relations
  @column()
  declare healthId: number

  @belongsTo(() => Health)
  declare health: BelongsTo<typeof Health>
}
