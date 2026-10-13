import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BasketballGame from '#models/basketball_game'

export default class BasketballGameStatPlayer extends BaseModel {
  public static table = 'basketball_games_stats_players'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare basketballGameId: number

  @column()
  declare apiPlayerId: number

  @column()
  declare apiTeamId: number

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

  @belongsTo(() => BasketballGame, {
    foreignKey: 'basketballGameId',
  })
  declare basketballGame: BelongsTo<typeof BasketballGame>
}
