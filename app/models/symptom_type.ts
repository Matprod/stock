import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'
import HealthRating from '#models/health_rating'

export default class SymptomType extends BaseModel {
  public static table = 'base_typeofsymptom'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string | null

  @column()
  declare nameEn: string | null

  @column()
  declare definitionEn: string | null

  @column()
  declare definitionFr: string | null

  @column()
  declare addedById: number | null

  @belongsTo(() => Athlete)
  declare addedBy: BelongsTo<typeof Athlete> | null

  @hasMany(() => HealthRating)
  declare healthRatings: HasMany<typeof HealthRating>
}