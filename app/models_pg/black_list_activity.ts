import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Activity from '#models_pg/activity'
import Club from '#models_pg/club'

export default class BlackListActivity extends BaseModel {
  static table = 'blacklist_activities'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare clubId: string

  @column()
  declare activityId: string

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @belongsTo(() => Activity)
  declare activity: BelongsTo<typeof Activity>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
