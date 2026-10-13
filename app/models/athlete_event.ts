import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'
import Event from '#models/event'

export default class AthleteEvent extends BaseModel {
  public static table = 'athlete_events'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare athleteId: number

  @column()
  declare eventId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Athlete, {
    foreignKey: 'athleteId',
  })
  declare athlete: BelongsTo<typeof Athlete>

  @belongsTo(() => Event, {
    foreignKey: 'eventId',
  })
  declare event: BelongsTo<typeof Event>
}
