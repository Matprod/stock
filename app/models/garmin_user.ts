import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'

export default class GarminUser extends BaseModel {
  public static table = 'base_garminathlete'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'access_token' })
  declare accessToken: string | null

  @column({ columnName: 'access_token_secret' })
  declare accessTokenSecret: string | null

  @column({ columnName: 'garmin_user_id' })
  declare garminUserId: string | null

  @column({ columnName: 'athlete_id' })
  declare athleteId: number

  @belongsTo(() => Athlete, { foreignKey: 'athleteId' })
  declare athlete: BelongsTo<typeof Athlete>
}
