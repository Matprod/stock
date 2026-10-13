import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasOne, hasMany, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne, HasMany } from '@adonisjs/lucid/types/relations'
import Club from '#models_pg/club'
import Event from '#models_pg/event'
import BasketballGameStat from '#models_pg/basketball_game_stat'
import BasketballGameStatPlayer from '#models_pg/basketball_game_player_stat'
import type { BasketballGameStatus } from '#contracts/basketball'

export default class BasketballGame extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare clubId: string

  @column()
  declare eventId: string | null

  @column()
  declare apiGameId: number

  @column.dateTime()
  declare startTime: DateTime

  @column.dateTime()
  declare endTime: DateTime

  @column()
  declare timestamp: number

  @column()
  declare title: string

  @column()
  declare location: string | null

  @column()
  declare statusShort: BasketballGameStatus | null

  @column()
  declare leagueId: number | null

  @column()
  declare leagueName: string | null

  @column()
  declare leagueSeason: string | null

  @column()
  declare leagueLogo: string | null

  @column()
  declare homeTeamId: number

  @column()
  declare homeTeamName: string

  @column()
  declare awayTeamId: number

  @column()
  declare awayTeamName: string

  @column()
  declare homeScoreQ1: number | null

  @column()
  declare homeScoreQ2: number | null

  @column()
  declare homeScoreQ3: number | null

  @column()
  declare homeScoreQ4: number | null

  @column()
  declare homeScoreOt: number | null

  @column()
  declare homeScoreTotal: number | null

  @column()
  declare awayScoreQ1: number | null

  @column()
  declare awayScoreQ2: number | null

  @column()
  declare awayScoreQ3: number | null

  @column()
  declare awayScoreQ4: number | null

  @column()
  declare awayScoreOt: number | null

  @column()
  declare awayScoreTotal: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @computed()
  get matchResult() {
    return `${this.homeScoreTotal}-${this.awayScoreTotal}`
  }

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @belongsTo(() => Event)
  declare event: BelongsTo<typeof Event>

  @hasOne(() => BasketballGameStat)
  declare gameStat: HasOne<typeof BasketballGameStat>

  @hasMany(() => BasketballGameStatPlayer)
  declare playerStats: HasMany<typeof BasketballGameStatPlayer>
}
