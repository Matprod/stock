import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { EventCategory } from '#constants/event.constants'
import Event from '#models/event'
import Athlete from '#models/athlete'

export default class PlayerNote extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare athleteId: number

  @column()
  declare eventId: number | null

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

  @belongsTo(() => Event, { foreignKey: 'eventId' })
  declare event: BelongsTo<typeof Event>

  @belongsTo(() => Athlete, { foreignKey: 'athleteId' })
  declare athlete: BelongsTo<typeof Athlete>
}
