import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import SportActivity from '#models/sport_activity'

export default class FitData extends BaseModel {
  public static table = 'sportactivity_fitdata'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'data', consume: (value) => value || null })
  declare data: Array<{
    timestamp?: string
    heart_rate?: number
    heartRate?: number
    speed?: number
    distance?: number
    elevation?: number
    power?: number
    cadence?: number
    bike_cadence_in_rpm?: number
    swim_cadence_in_strokes_per_minute?: number
  }> | null

  @column({ columnName: 'sport_activity_id' })
  declare sportActivityId: number

  @belongsTo(() => SportActivity, {
    foreignKey: 'sportActivityId',
  })
  declare sportActivity: BelongsTo<typeof SportActivity>
}

