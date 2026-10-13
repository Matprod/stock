import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sleeps';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.uuid('day_id').references('id').inTable('days').onDelete('CASCADE').notNullable();
            table.dateTime('bedtime_date').nullable();
            table.dateTime('wake_up_date').nullable();
            table.integer('quality_rating').nullable();
            table.string('data_source').nullable();
            table.float('sleep_efficiency_percentage').nullable();
            table.float('sleep_consistency_percentage').nullable();
            table.integer('need_from_sleep_debt_milli').nullable();
            table.float('total_slow_wave_sleep_time_milli').nullable();
            table.float('total_rem_sleep_time_milli').nullable();
            table.float('total_in_bed_time_milli').nullable();
            table.integer('total_awake_time_milli').nullable();
            table.integer('baseline_mili').nullable();
            table.bigint('nap_am').nullable();
            table.bigint('nap_pm').nullable();
            table.timestamps(true, true);
            table.check('quality_rating >= 0');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780587166777_create_sleeps_table.js.map