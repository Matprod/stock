import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import AthleteSport from '#models/athlete_sport'
import Club from '#models/club'

export default class Sport extends BaseModel {
  public static table = 'base_sport'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string

  @column()
  declare nameEn: string

  @hasMany(() => AthleteSport)
  declare athleteSports: HasMany<typeof AthleteSport>

  @hasMany(() => Club)
  declare clubs: HasMany<typeof Club>
}
