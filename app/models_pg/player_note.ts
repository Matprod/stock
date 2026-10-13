import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { EventCategory } from '#constants/event.constants'
import Event from '#models_pg/event'
import Athlete from '#models_pg/athlete'

export default class PlayerNote extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare athleteId: string

  @column()
  declare eventId: string | null

  @column()
  declare category: EventCategory | null

  @column.date()
  declare noteDate: DateTime

  @column()
  declare content: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Event)
  declare event: BelongsTo<typeof Event>

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>
}
