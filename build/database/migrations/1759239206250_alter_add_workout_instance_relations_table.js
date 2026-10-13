import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_sportactivity';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table
                .integer('workout_session_instance_id')
                .unsigned()
                .nullable()
                .references('id')
                .inTable('workout_session_instances')
                .onDelete('SET NULL');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign(['workout_session_instance_id']);
            table.dropColumn('workout_session_instance_id');
        });
    }
}
//# sourceMappingURL=1759239206250_alter_add_workout_instance_relations_table.js.map