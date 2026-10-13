import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Activity from '#models/activity'
import Club from '#models/club'

export default class BlackListActivity extends BaseModel {
  public static table = 'black_list_activities'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clubId: number

  @column()
  declare activityId: number

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @belongsTo(() => Activity)
  declare activity: BelongsTo<typeof Activity>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
