import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BasketballGame from '#models_pg/basketball_game'

export default class BasketballGamePlayerStat extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare basketballGameId: string

  @column()
  declare apiPlayerId: number

  @column()
  declare apiTeamId: number | null

  @column()
  declare playerName: string | null

  @column()
  declare type: string | null

  @column()
  declare minutes: string | null

  @column()
  declare fieldGoalsTotal: number | null

  @column()
  declare fieldGoalsAttempts: number | null

  @column()
  declare threepointGoalsTotal: number | null

  @column()
  declare threepointGoalsAttempts: number | null

  @column()
  declare freethrowsGoalsTotal: number | null

  @column()
  declare freethrowsGoalsAttempts: number | null

  @column()
  declare reboundsTotal: number | null

  @column()
  declare assists: number | null

  @column()
  declare points: number | null

  @column()
  declare plusMinus: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => BasketballGame)
  declare basketballGame: BelongsTo<typeof BasketballGame>
}
