import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Health from '#models/health'
import SymptomType from '#models/symptom_type'

export default class HealthRating extends BaseModel {
  public static table = 'health_healthrating'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare rating: number

  @column()
  declare healthId: number | null

  @column()
  declare typeOfRatingId: number | null

  @column.dateTime()
  declare dateUpdated: DateTime

  @belongsTo(() => Health)
  declare health: BelongsTo<typeof Health>

  @belongsTo(() => SymptomType, {
    foreignKey: 'typeOfRatingId'
  })
  declare typeOfRating: BelongsTo<typeof SymptomType>
}
