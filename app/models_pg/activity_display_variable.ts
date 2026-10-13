import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import Activity from '#models_pg/activity'
import Club from '#models_pg/club'
import DisplayVariable from '#models_pg/display_variable'
import type { DisplayVariableUnit } from '#constants/display_variable.constants'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class ActivityDisplayVariable extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare activityId: string

  @column()
  declare displayVariableId: string

  @column()
  declare clubId: string | null

  @column()
  declare unit: DisplayVariableUnit | null

  @belongsTo(() => Activity)
  declare activity: BelongsTo<typeof Activity>

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @belongsTo(() => DisplayVariable)
  declare displayVariable: BelongsTo<typeof DisplayVariable>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
