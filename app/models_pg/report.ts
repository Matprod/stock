import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Club from '#models_pg/club'
import User from '#models_pg/user'
import type { ReportBlocSpec } from '#contracts/report_builder'

export default class Report extends BaseModel {
  static table = 'reports'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare clubId: string

  @column()
  declare createdBy: string | null

  @column()
  declare title: string

  @column.date()
  declare dateFrom: DateTime

  @column.date()
  declare dateTo: DateTime

  @column({
    consume: (value: string | ReportBlocSpec[]) =>
      typeof value === 'string' ? (JSON.parse(value) as ReportBlocSpec[]) : value,
    prepare: (value: ReportBlocSpec[]) => JSON.stringify(value),
  })
  declare blocs: ReportBlocSpec[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare author: BelongsTo<typeof User>
}
