import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ValdTest from '#models/vald_test'
import { DateTime } from 'luxon'

export default class ValdTrial extends BaseModel {
  public static table = 'vald_trials'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare valdTestId: number

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

  @belongsTo(() => ValdTest, { foreignKey: 'valdTestId' })
  declare valdTest: BelongsTo<typeof ValdTest>
} 