import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import InjuryCategory from '#models/injury_category'
import Club from '#models/club'

export default class InjuryType extends BaseModel {
  public static table = 'base_typeofinjury'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string

  @column()
  declare nameEn: string

  // RELATIONS

  @column()
  declare categoryId: number

  @belongsTo(() => InjuryCategory, {
    foreignKey: 'categoryId',
  })
  declare category: BelongsTo<typeof InjuryCategory>

  @column()
  declare clubId: number | null

  @belongsTo(() => Club, {
    foreignKey: 'clubId',
  })
  declare club: BelongsTo<typeof Club>
}
