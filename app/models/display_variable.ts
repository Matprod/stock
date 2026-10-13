import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import ActivityDisplayVariable from '#models/activity_display_variable'

export default class DisplayVariable extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare labelFr: string

  @column()
  declare labelEn: string

  @hasMany(() => ActivityDisplayVariable)
  declare activityDisplayVariables: HasMany<typeof ActivityDisplayVariable>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
