import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Day from '#models_pg/day'
import ValdTrial from '#models_pg/vald_trial'

export default class ValdTest extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare dayId: string

  @column()
  declare testType: string

  @column()
  declare providerTestId: string | null

  @column()
  declare value: string | null

  @belongsTo(() => Day)
  declare day: BelongsTo<typeof Day>

  @hasMany(() => ValdTrial)
  declare trials: HasMany<typeof ValdTrial>
}
