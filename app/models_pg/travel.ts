import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Health from '#models_pg/health_rating'
import Event from '#models_pg/event'
import { formatMinutesToHuman } from '#utils/time'
import type { TravelType } from '#contracts/travel'

export default class Travel extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare meanOfTransport: TravelType

  @column()
  declare durationMinutes: number

  @computed()
  get durationText(): string | null {
    return this.durationMinutes ? formatMinutesToHuman(this.durationMinutes) : null
  }

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare eventId: string | null

  @belongsTo(() => Event)
  declare event: BelongsTo<typeof Event>

  // Relations
  @column()
  declare healthId: string

  @belongsTo(() => Health, { foreignKey: 'healthId' })
  declare health: BelongsTo<typeof Health>
}
