import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'vald_trials';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.float('trial_jump_height').nullable();
            table.float('trial_rsi_modified').nullable();
            table.float('trial_peak_takeoff_power').nullable();
            table.float('trial_concentric_rfd').nullable();
            table.float('trial_peak_landing_force').nullable();
            table.float('trial_time_to_stabilisation').nullable();
            table.float('trial_rsi').nullable();
            table.float('trial_eccentric_braking_rfd').nullable();
            table
                .uuid('vald_test_id')
                .notNullable()
                .references('id')
                .inTable('vald_tests')
                .onDelete('CASCADE');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780576546913_create_vald_trials_table.js.map