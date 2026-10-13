import { MetricDomain } from '#contracts/metric';
import { MetricService } from '#services/metric_service';
import { BaseTrainingLoad } from '../base.js';
const periodMetricService = new MetricService(MetricDomain.PERIOD);
export class StaticShootingTrainingLoad extends BaseTrainingLoad {
    type;
    constructor(sportActivity, type) {
        super(sportActivity);
        this.type = type;
    }
    calculateExternalTrainingLoad() {
        const { durationInMinutes } = this.sportActivity;
        const period = this.sportActivity.periods?.[0];
        const { weapon_weight: weaponWeight, carried_weight: carriedWeight } = period
            ? periodMetricService.extractNumericMetricsAsObject(period, [
                'weapon_weight',
                'carried_weight',
            ])
            : { weapon_weight: null, carried_weight: null };
        switch (this.type) {
            case 'Tir statique - configuration légère':
            case 'Tir statique - configuration lourde':
                return ((weaponWeight ?? 0) + 0.2 * (carriedWeight ?? 0)) * (durationInMinutes ?? 0);
            default:
                throw new Error(`Invalid combat type: ${this.type}`);
        }
    }
}
//# sourceMappingURL=static_shooting.js.map