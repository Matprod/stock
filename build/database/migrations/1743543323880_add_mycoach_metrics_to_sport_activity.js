import { BaseSchema } from '@adonisjs/lucid/schema';
export default class AddMyCoachMetricsToSportActivity extends BaseSchema {
    tableName = 'sportactivity_sportactivity';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.decimal('distance_0_7_kmh', 10, 2).nullable();
            table.decimal('distance_7_14_kmh', 10, 2).nullable();
            table.decimal('distance_14_19_kmh', 10, 2).nullable();
            table.decimal('distance_19_25_kmh', 10, 2).nullable();
            table.decimal('distance_25_plus_kmh', 10, 2).nullable();
            table.integer('nb_efforts_above_19_8_kmh').nullable();
            table.integer('nb_efforts_above_25_kmh').nullable();
            table.decimal('top_speed', 10, 2).nullable();
            table.string('event_type').nullable();
            table.decimal('vmax_acceleration', 10, 2).nullable();
            table.decimal('vmax_deceleration', 10, 2).nullable();
            table.integer('nb_decelerations_above_3ms2').nullable();
            table.integer('nb_accelerations_above_3ms2').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('distance_0_7_kmh');
            table.dropColumn('distance_7_14_kmh');
            table.dropColumn('distance_14_19_kmh');
            table.dropColumn('distance_19_25_kmh');
            table.dropColumn('distance_25_plus_kmh');
            table.dropColumn('nb_efforts_above_19_8_kmh');
            table.dropColumn('nb_efforts_above_25_kmh');
            table.dropColumn('top_speed');
            table.dropColumn('event_type');
            table.dropColumn('vmax_acceleration');
            table.dropColumn('vmax_deceleration');
            table.dropColumn('nb_decelerations_above_3ms2');
            table.dropColumn('nb_accelerations_above_3ms2');
        });
    }
}
//# sourceMappingURL=1743543323880_add_mycoach_metrics_to_sport_activity.js.map