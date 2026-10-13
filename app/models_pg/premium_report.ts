import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type {
  PremiumReportDocument,
  PremiumReportHistoryTurn,
} from '#contracts/premium_report'
import Club from '#models_pg/club'
import User from '#models_pg/user'

const readJson = <T>(value: T | string | null, fallback: T): T => {
  if (value == null) return fallback
  if (typeof value !== 'string') return value
  return JSON.parse(value) as T
}

export default class PremiumReport extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare clubId: string

  @column()
  declare userId: string

  @column()
  declare title: string

  @column.date()
  declare dateFrom: DateTime

  @column.date()
  declare dateTo: DateTime

  @column({
    prepare: (value: PremiumReportDocument) => JSON.stringify(value),
    consume: (value: PremiumReportDocument | string | null) =>
      readJson(value, {} as PremiumReportDocument),
  })
  declare document: PremiumReportDocument

  @column({
    prepare: (value: PremiumReportHistoryTurn[]) => JSON.stringify(value),
    consume: (value: PremiumReportHistoryTurn[] | string | null) =>
      readJson(value, [] as PremiumReportHistoryTurn[]),
  })
  declare history: PremiumReportHistoryTurn[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
