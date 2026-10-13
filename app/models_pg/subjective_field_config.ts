import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import Club from '#models_pg/club'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { SubjectiveVariableDomain } from '#contracts/subjective_variable'

export default class SubjectiveFieldConfig extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare clubId: string

  @column()
  declare fieldName: string

  @column()
  declare domain: SubjectiveVariableDomain

  @column()
  declare minScale: number

  @column()
  declare maxScale: number

  @column()
  declare isReversed: boolean

  @column()
  declare gap: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>
}
