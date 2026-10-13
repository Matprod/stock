import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import EventType from '#models/event_type'
import Club from '#models/club'
import SportActivity from '#models/sport_activity'
import Athlete from '#models/athlete'
import Travel from '#models/travel'
import BasketballGame from '#models/basketball_game'

export default class Event extends BaseModel {
  public static table = 'events'

  @column({ isPrimary: true })
  declare id: number

  @column.dateTime()
  declare startTime: DateTime

  @column.dateTime()
  declare endTime: DateTime

  @column()
  declare title: string

  @column()
  declare location: string | null

  @column()
  declare eventTypeId: number

  @column()
  declare clubId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => EventType, {
    foreignKey: 'eventTypeId',
  })
  declare eventType: BelongsTo<typeof EventType>

  @belongsTo(() => Club, {
    foreignKey: 'clubId',
  })
  declare club: BelongsTo<typeof Club>

  @hasMany(() => SportActivity, {
    foreignKey: 'eventId',
  })
  declare sportActivities: HasMany<typeof SportActivity>

  @manyToMany(() => Athlete, {
    pivotTable: 'athlete_events',
    pivotForeignKey: 'event_id',
    pivotRelatedForeignKey: 'athlete_id',
  })
  declare athletes: ManyToMany<typeof Athlete>

  @hasMany(() => Travel, {
    foreignKey: 'eventId',
  })
  declare travels: HasMany<typeof Travel>

  @hasMany(() => BasketballGame, {
    foreignKey: 'eventId',
  })
  declare basketballGames: HasMany<typeof BasketballGame>
}
