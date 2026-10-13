import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'base_athletedayavg';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('tmp_injury');
            table.decimal('training_load', 10, 4).nullable();
            table.decimal('training_load_high_intensity', 10, 4).nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('tmp_injury').nullable();
            table.dropColumn('training_load');
            table.dropColumn('training_load_high_intensity');
        });
    }
}
//# sourceMappingURL=1747128717529_alter_add_training_loads_table.js.map