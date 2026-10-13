import { DateTime } from 'luxon'
import { BaseModel, beforeSave, belongsTo, column } from '@adonisjs/lucid/orm'
import Club from '#models_pg/club'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class ClubSetting extends BaseModel {
  @beforeSave()
  static validateThresholds(row: ClubSetting) {
    const validateLevel = (medium: number, high: number, label: string) => {
      if (medium < 0 || medium > 100 || high < 0 || high > 100) {
        throw new Error(`${label} thresholds must be between 0 and 100`)
      }

      if (medium >= high) {
        throw new Error(`${label} medium threshold must be strictly lower than high threshold`)
      }
    }

    validateLevel(row.performanceMedium, row.performanceHigh, 'Performance')
    validateLevel(row.injuryMedium, row.injuryHigh, 'Injury')
    validateLevel(row.availabilityMedium, row.availabilityHigh, 'Availability')
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare clubId: string | null

  @column()
  declare performanceHigh: number

  @column()
  declare performanceMedium: number

  @column()
  declare injuryHigh: number

  @column()
  declare injuryMedium: number

  @column()
  declare availabilityHigh: number

  @column()
  declare availabilityMedium: number

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
