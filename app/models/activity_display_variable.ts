import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import Activity from '#models/activity'
import DisplayVariable from '#models/display_variable'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class ActivityDisplayVariable extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare activityId: number

  @column()
  declare displayVariableId: number

  @column()
  declare unit: string | null

  @belongsTo(() => Activity)
  declare activity: BelongsTo<typeof Activity>

  @belongsTo(() => DisplayVariable)
  declare displayVariable: BelongsTo<typeof DisplayVariable>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
