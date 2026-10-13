var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { METRIC_AGGREGATION_METHOD, METRIC_DATA_TYPE } from '#constants/metrics.constants';
import SportActivityMetric from '#models_pg/sport_activity_metric';
import { BaseCommand, flags } from '@adonisjs/core/ace';
const SPORT_ACTIVITY_METRIC_DEFS = {
    minutes_played: {
        description: 'Minutes played in the session/competition',
        unit: 'min',
        dataType: METRIC_DATA_TYPE.FLOAT,
        aggregationMethod: METRIC_AGGREGATION_METHOD.SUM,
    },
    total_distance: {
        description: 'Total distance covered',
        unit: 'm',
        dataType: METRIC_DATA_TYPE.FLOAT,
        aggregationMethod: METRIC_AGGREGATION_METHOD.SUM,
    },
    sprint_distance: {
        description: 'Distance covered while sprinting',
        unit: 'm',
        dataType: METRIC_DATA_TYPE.FLOAT,
        aggregationMethod: METRIC_AGGREGATION_METHOD.SUM,
    },
    intensive_run_distance: {
        description: 'Distance covered in intensive runs',
        unit: 'm',
        dataType: METRIC_DATA_TYPE.FLOAT,
        aggregationMethod: METRIC_AGGREGATION_METHOD.SUM,
    },
    max_speed: {
        description: 'Maximum speed reached',
        unit: 'km/h',
        dataType: METRIC_DATA_TYPE.FLOAT,
        aggregationMethod: METRIC_AGGREGATION_METHOD.MAX,
    },
    tackles_contested: {
        description: 'Number of contested tackles',
        unit: 'count',
        dataType: METRIC_DATA_TYPE.INTEGER,
        aggregationMethod: METRIC_AGGREGATION_METHOD.SUM,
    },
    tackles_won: {
        description: 'Number of tackles won',
        unit: 'count',
        dataType: METRIC_DATA_TYPE.INTEGER,
        aggregationMethod: METRIC_AGGREGATION_METHOD.SUM,
    },
};
export default class SeedSportActivityMetrics extends BaseCommand {
    static commandName = 'sport-activity-metrics:seed';
    static description = 'Create sport_activity_metrics catalog rows';
    static options = {
        startApp: true,
    };
    async run() {
        const entries = Object.entries(SPORT_ACTIVITY_METRIC_DEFS);
        this.logger.info(`${entries.length} sport activity metrics to seed`);
        let created = 0;
        let existing = 0;
        for (const [name, def] of entries) {
            if (this.dryRun) {
                this.logger.info(`  ${name} (${def.dataType}, ${def.aggregationMethod})`);
                continue;
            }
            const existingMetric = await SportActivityMetric.findBy('name', name);
            if (existingMetric) {
                existing++;
                continue;
            }
            await SportActivityMetric.create({
                name,
                description: def.description,
                unit: def.unit,
                dataType: def.dataType,
                aggregationMethod: def.aggregationMethod,
            });
            created++;
        }
        if (this.dryRun)
            return;
        this.logger.success(`Done: ${created} created, ${existing} already existed`);
    }
}
__decorate([
    flags.boolean({ description: 'List metrics without writing to DB' }),
    __metadata("design:type", Boolean)
], SeedSportActivityMetrics.prototype, "dryRun", void 0);
//# sourceMappingURL=seed_sport_activity_metrics.js.map