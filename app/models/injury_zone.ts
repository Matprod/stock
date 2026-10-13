import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import DiscomfortLocation from '#models/discomfort_location'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import InjuryCategory from '#models/injury_category'

export default class InjuryZone extends BaseModel {
  public static table = 'base_zone'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare side: string | null

  @column()
  declare name: string | null

  @hasMany(() => DiscomfortLocation, {
    foreignKey: 'zoneId',
  })
  declare locations: HasMany<typeof DiscomfortLocation>

  @hasMany(() => InjuryCategory, {
    foreignKey: 'zoneId',
  })
  declare categories: HasMany<typeof InjuryCategory>
}
