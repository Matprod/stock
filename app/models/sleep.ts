import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, computed, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Day from '#models/day'
import SleepMetricValue from '#models/sleep_metric_value'

export default class Sleep extends BaseModel {
  public static table = 'sleep_sleep'

  @column({ isPrimary: true })
  declare id: number

  @column.dateTime()
  declare bedtimeDate: DateTime | null

  @column.dateTime()
  declare wakeUpDate: DateTime | null

  @column()
  declare qualityRating: number | null

  @column()
  declare dataSource:
    | 'manual'
    | 'garmin'
    | 'suunto'
    | 'polar'
    | 'coros'
    | 'strava'
    | 'wahoo'
    | 'whoop'
    | 'my_coach'
    | 'train_my_athlete'
    | null

  @column()
  declare sleepEfficiencyPercentage: number | null

  @column()
  declare sleepConsistencyPercentage: number | null

  @column()
  declare needFromSleepDebtMilli: number | null

  @column()
  declare totalSlowWaveSleepTimeMilli: number | null

  @column()
  declare totalRemSleepTimeMilli: number | null

  @column()
  declare totalInBedTimeMilli: number | null

  @column()
  declare totalAwakeTimeMilli: number | null

  @column()
  declare baselineMili: number | null

  @column()
  declare napAm: number | null

  @column()
  declare napPm: number | null

  @column.dateTime({ autoCreate: true })
  declare dateAdded: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare dateUpdated: DateTime | null

  // duration in hours
  @computed()
  get durationHours(): number | null {
    return this.totalInBedTimeMilli ? this.totalInBedTimeMilli / (1000 * 60 * 60) : null
  }

  // RELATIONS
  @column()
  declare athleteDayId: number

  @belongsTo(() => Day, {
    foreignKey: 'athleteDayId',
  })
  declare day: BelongsTo<typeof Day>

  @hasMany(() => SleepMetricValue)
  declare metricValues: HasMany<typeof SleepMetricValue>
}
