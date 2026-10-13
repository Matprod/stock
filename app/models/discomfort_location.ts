import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import InjuryZone from '#models/injury_zone'

export default class DiscomfortLocation extends BaseModel {
  public static table = 'base_paindiscomfortlocation'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string | null

  @column()
  declare nameEn: string | null

  getName(language: 'en' | 'fr'): string {
    if (language === 'en') {
      return this.nameEn || this.nameFr || 'Unknown location'
    }
    return this.nameFr || this.nameEn || 'Unknown location'
  }

  // RELATIONS

  @column()
  declare zoneId: number | null

  @belongsTo(() => InjuryZone, {
    foreignKey: 'zoneId',
  })
  declare zone: BelongsTo<typeof InjuryZone>
}