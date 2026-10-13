import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import EventType from '#models_pg/event_type'
import Club from '#models_pg/club'
import SportActivity from '#models_pg/sport_activity'
import Athlete from '#models_pg/athlete'
import Travel from '#models_pg/travel'
import BasketballGame from '#models_pg/basketball_game'

export default class Event extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column.dateTime()
  declare startTime: DateTime

  @column.dateTime()
  declare endTime: DateTime

  @column()
  declare title: string

  @column()
  declare location: string | null

  @column()
  declare eventTypeId: string

  @column()
  declare clubId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => EventType)
  declare eventType: BelongsTo<typeof EventType>

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @hasMany(() => SportActivity)
  declare sportActivities: HasMany<typeof SportActivity>

  @manyToMany(() => Athlete, {
    pivotTable: 'athlete_events',
    pivotForeignKey: 'event_id',
    pivotRelatedForeignKey: 'athlete_id',
  })
  declare athletes: ManyToMany<typeof Athlete>

  @hasMany(() => Travel)
  declare travels: HasMany<typeof Travel>

  @hasMany(() => BasketballGame)
  declare basketballGames: HasMany<typeof BasketballGame>
}
