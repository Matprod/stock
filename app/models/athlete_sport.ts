import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'
import Sport from '#models/sport'

export default class AthleteSport extends BaseModel {
  public static table = 'base_athlete_sports'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare athleteId: number

  @column()
  declare sportId: number

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @belongsTo(() => Sport)
  declare sport: BelongsTo<typeof Sport>
} 