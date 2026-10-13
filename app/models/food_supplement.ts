import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import SupplementsName from '#models/health_food_supplement_name'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Medication from '#models/medication'

export default class FoodSupplement extends BaseModel {
  public static table = 'health_foodsupplement'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare quantity: number

  @column()
  declare suppNameId: number

  @belongsTo(() => SupplementsName, {
    foreignKey: 'suppNameId',
  })
  declare suppName: BelongsTo<typeof SupplementsName>

  @column()
  declare medicationId: number

  @belongsTo(() => Medication, {
    foreignKey: 'medicationId',
  })
  declare medication: BelongsTo<typeof Medication>

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare dateUpdated: DateTime
}
