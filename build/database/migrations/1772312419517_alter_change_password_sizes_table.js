import { BaseSchema } from '@adonisjs/lucid/schema';
export default class AlterAthletePasswordColumnLength extends BaseSchema {
    tableName = 'base_athlete';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('password', 255).alter();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('password', 128).alter();
        });
    }
}
//# sourceMappingURL=1772312419517_alter_change_password_sizes_table.js.map