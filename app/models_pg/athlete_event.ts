import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models_pg/athlete'
import Event from '#models_pg/event'

export default class AthleteEvent extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare athleteId: string

  @column()
  declare eventId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @belongsTo(() => Event)
  declare event: BelongsTo<typeof Event>
}
