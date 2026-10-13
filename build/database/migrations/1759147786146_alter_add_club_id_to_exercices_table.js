import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_reinforcementexercices';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.integer('club_id').unsigned().references('id').inTable('clubs').onDelete('CASCADE');
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('club_id');
        });
    }
}
//# sourceMappingURL=1759147786146_alter_add_club_id_to_exercices_table.js.map