import { MilitaryActivity } from '#constants/garmin.constants'
import SportActivity from '#models_pg/sport_activity'
import { MetricDomain } from '#contracts/metric'
import { MetricService } from '#services/metric_service'
import { BaseTrainingLoad } from '../base.js'

const periodMetricService = new MetricService(MetricDomain.PERIOD)

export type StaticShootingType = Extract<
  MilitaryActivity,
  'Tir statique - configuration légère' | 'Tir statique - configuration lourde'
>

export class StaticShootingTrainingLoad extends BaseTrainingLoad {
  private type: StaticShootingType

  constructor(sportActivity: SportActivity, type: StaticShootingType) {
    super(sportActivity)
    this.type = type
  }

  calculateExternalTrainingLoad() {
    const { durationInMinutes } = this.sportActivity
    const period = this.sportActivity.periods?.[0]
    const { weapon_weight: weaponWeight, carried_weight: carriedWeight } = period
      ? periodMetricService.extractNumericMetricsAsObject(period, [
          'weapon_weight',
          'carried_weight',
        ])
      : { weapon_weight: null, carried_weight: null }

    switch (this.type) {
      case 'Tir statique - configuration légère':
      case 'Tir statique - configuration lourde':
        return ((weaponWeight ?? 0) + 0.2 * (carriedWeight ?? 0)) * (durationInMinutes ?? 0)
      default:
        throw new Error(`Invalid combat type: ${this.type}`)
    }
  }
}
