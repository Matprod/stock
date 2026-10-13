import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import Day from '#models/day'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import FoodSupplement from '#models/food_supplement'

export default class Medication extends BaseModel {
  public static table = 'health_medication'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare athleteDayId: number

  @belongsTo(() => Day, {
    foreignKey: 'athleteDayId',
  })
  declare day: BelongsTo<typeof Day>

  @column.dateTime({ autoCreate: true })
  declare dateAdded: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare dateUpdated: DateTime

  @hasMany(() => FoodSupplement, {
    foreignKey: 'medicationId',
  })
  declare foodSupplements: HasMany<typeof FoodSupplement>
}
