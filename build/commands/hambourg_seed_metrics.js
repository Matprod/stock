var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { STATSSPORTS_PERIOD_METRIC_DEFS } from '#constants/statsports.constants';
import PeriodMetric from '#models_pg/period_metric';
import { BaseCommand, flags } from '@adonisjs/core/ace';
export default class HambourgSeedMetrics extends BaseCommand {
    static commandName = 'hambourg:seed-metrics';
    static description = 'Create period_metrics rows for STATSports KPI columns';
    static options = {
        startApp: true,
    };
    async run() {
        const entries = Object.entries(STATSSPORTS_PERIOD_METRIC_DEFS);
        this.logger.info(`${entries.length} STATSports KPI metrics to seed`);
        let created = 0;
        let updated = 0;
        let unchanged = 0;
        for (const [name, def] of entries) {
            const payload = {
                name,
                description: null,
                unit: null,
                dataType: def.dataType,
                aggregationMethod: def.aggregationMethod,
            };
            if (this.dryRun) {
                this.logger.info(`  ${name} (${def.dataType}, ${def.aggregationMethod})`);
                continue;
            }
            const existingMetric = await PeriodMetric.findBy('name', name);
            if (existingMetric) {
                if (existingMetric.dataType !== def.dataType ||
                    existingMetric.aggregationMethod !== def.aggregationMethod) {
                    existingMetric.dataType = def.dataType;
                    existingMetric.aggregationMethod = def.aggregationMethod;
                    await existingMetric.save();
                    updated++;
                }
                else {
                    unchanged++;
                }
                continue;
            }
            await PeriodMetric.create(payload);
            created++;
        }
        if (this.dryRun)
            return;
        this.logger.success(`Done: ${created} created, ${updated} updated, ${unchanged} unchanged`);
    }
}
__decorate([
    flags.boolean({ description: 'List metrics without writing to DB' }),
    __metadata("design:type", Boolean)
], HambourgSeedMetrics.prototype, "dryRun", void 0);
//# sourceMappingURL=hambourg_seed_metrics.js.map