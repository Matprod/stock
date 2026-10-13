import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BasketballGame from '#models_pg/basketball_game'

export default class BasketballGameStat extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare basketballGameId: string

  @column()
  declare homeFieldGoalsTotal: number | null

  @column()
  declare homeFieldGoalsAttempts: number | null

  @column()
  declare homeThreepointGoalsTotal: number | null

  @column()
  declare homeThreepointGoalsAttempts: number | null

  @column()
  declare homeFreethrowsGoalsTotal: number | null

  @column()
  declare homeFreethrowsGoalsAttempts: number | null

  @column()
  declare homeReboundsTotal: number | null

  @column()
  declare homeReboundsOffence: number | null

  @column()
  declare homeReboundsDefense: number | null

  @column()
  declare homeAssists: number | null

  @column()
  declare homeSteals: number | null

  @column()
  declare homeBlocks: number | null

  @column()
  declare homeTurnovers: number | null

  @column()
  declare homePersonalFouls: number | null

  @column()
  declare awayFieldGoalsTotal: number | null

  @column()
  declare awayFieldGoalsAttempts: number | null

  @column()
  declare awayThreepointGoalsTotal: number | null

  @column()
  declare awayThreepointGoalsAttempts: number | null

  @column()
  declare awayFreethrowsGoalsTotal: number | null

  @column()
  declare awayFreethrowsGoalsAttempts: number | null

  @column()
  declare awayReboundsTotal: number | null

  @column()
  declare awayReboundsOffence: number | null

  @column()
  declare awayReboundsDefense: number | null

  @column()
  declare awayAssists: number | null

  @column()
  declare awaySteals: number | null

  @column()
  declare awayBlocks: number | null

  @column()
  declare awayTurnovers: number | null

  @column()
  declare awayPersonalFouls: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => BasketballGame)
  declare basketballGame: BelongsTo<typeof BasketballGame>
}
