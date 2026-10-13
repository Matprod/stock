import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'

export default class SupplementsName extends BaseModel {
  public static table = 'health_foodsupplementname'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string | null

  @column()
  declare unitFr: string | null

  @column()
  declare nameEn: string | null

  @column()
  declare unitEn: string | null

  @column()
  declare addedById: number | null

  @belongsTo(() => Athlete)
  declare addedBy: BelongsTo<typeof Athlete>
}
