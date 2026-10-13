import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_sportactivity';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.float('energy_consumption_carbs').nullable();
            table.float('energy_consumption_fats').nullable();
            table.float('epoc_final').nullable();
            table.float('epoc_peak').nullable();
            table.float('hf_average').nullable();
            table.float('lf_average').nullable();
            table.float('lf_hf_ratio').nullable();
            table.float('rmssd').nullable();
            table.float('trimp').nullable();
            table.float('zone1_time').nullable();
            table.float('zone2_time').nullable();
            table.float('zone3_time').nullable();
            table.float('zone4_time').nullable();
            table.float('zone5_time').nullable();
            table.text('energy_consumption_series', 'longtext').nullable();
            table.text('epoc_series', 'longtext').nullable();
            table.text('heart_rate_series', 'longtext').nullable();
            table.text('trimp_series', 'longtext').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('energy_consumption_carbs');
            table.dropColumn('energy_consumption_fats');
            table.dropColumn('epoc_final');
            table.dropColumn('epoc_peak');
            table.dropColumn('hf_average');
            table.dropColumn('lf_average');
            table.dropColumn('lf_hf_ratio');
            table.dropColumn('rmssd');
            table.dropColumn('trimp');
            table.dropColumn('zone1_time');
            table.dropColumn('zone2_time');
            table.dropColumn('zone3_time');
            table.dropColumn('zone4_time');
            table.dropColumn('zone5_time');
            table.dropColumn('energy_consumption_series');
            table.dropColumn('epoc_series');
            table.dropColumn('heart_rate_series');
            table.dropColumn('trimp_series');
        });
    }
}
//# sourceMappingURL=1753108000_add_firstbeat_columns_to_sportactivity.js.map