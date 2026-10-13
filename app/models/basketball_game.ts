import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasOne, hasMany, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne, HasMany } from '@adonisjs/lucid/types/relations'
import Club from '#models/club'
import Event from '#models/event'
import BasketballGameStat from '#models/basketball_game_stat'
import BasketballGameStatPlayer from '#models/basketball_game_stat_player'
import type { BasketballGameStatus } from '#contracts/basketball'

export default class BasketballGame extends BaseModel {
  public static table = 'basketball_games'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clubId: number

  @column()
  declare eventId: number | null

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

  @column({ columnName: 'home_score_q1' })
  declare homeScoreQ1: number | null

  @column({ columnName: 'home_score_q2' })
  declare homeScoreQ2: number | null

  @column({ columnName: 'home_score_q3' })
  declare homeScoreQ3: number | null

  @column({ columnName: 'home_score_q4' })
  declare homeScoreQ4: number | null

  @column({ columnName: 'home_score_ot' })
  declare homeScoreOt: number | null

  @column({ columnName: 'home_score_total' })
  declare homeScoreTotal: number | null

  @column({ columnName: 'away_score_q1' })
  declare awayScoreQ1: number | null

  @column({ columnName: 'away_score_q2' })
  declare awayScoreQ2: number | null

  @column({ columnName: 'away_score_q3' })
  declare awayScoreQ3: number | null

  @column({ columnName: 'away_score_q4' })
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

  @belongsTo(() => Club, {
    foreignKey: 'clubId',
  })
  declare club: BelongsTo<typeof Club>

  @belongsTo(() => Event, {
    foreignKey: 'eventId',
  })
  declare event: BelongsTo<typeof Event>

  @hasOne(() => BasketballGameStat, {
    foreignKey: 'basketballGameId',
  })
  declare gameStat: HasOne<typeof BasketballGameStat>

  @hasMany(() => BasketballGameStatPlayer, {
    foreignKey: 'basketballGameId',
  })
  declare playerStats: HasMany<typeof BasketballGameStatPlayer>
}
