import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Day from '#models/day'
import ValdTrial from '#models/vald_trial'

export default class ValdTest extends BaseModel {
  public static table = 'vald_tests'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare athleteDayId: number

  @column()
  declare testType: string

  @column()
  declare value: string | null

  @belongsTo(() => Day, { foreignKey: 'athleteDayId' })
  declare athleteDay: BelongsTo<typeof Day>

  @hasMany(() => ValdTrial, { foreignKey: 'valdTestId' })
  declare trials: HasMany<typeof ValdTrial>
} 