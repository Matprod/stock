import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ValdTest from '#models_pg/vald_test'
import { DateTime } from 'luxon'

export default class ValdTrial extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare valdTestId: string

  @column()
  declare trialJumpHeight: number | null

  @column()
  declare trialRsiModified: number | null

  @column()
  declare trialPeakTakeoffPower: number | null

  @column()
  declare trialConcentricRfd: number | null

  @column()
  declare trialPeakLandingForce: number | null

  @column()
  declare trialTimeToStabilisation: number | null

  @column()
  declare trialRsi: number | null

  @column()
  declare trialEccentricBrakingRfd: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => ValdTest)
  declare valdTest: BelongsTo<typeof ValdTest>
}
