import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import InjuryZone from '#models/injury_zone'

export default class InjuryCategory extends BaseModel {
  public static table = 'base_typeofinjurycategory'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string

  @column()
  declare nameEn: string

  // RELATIONS

  @column()
  declare zoneId: number | null

  @belongsTo(() => InjuryZone, {
    foreignKey: 'zoneId',
  })
  declare zone: BelongsTo<typeof InjuryZone>
}
