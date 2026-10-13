import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'health_health';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.smallint('body_soreness_rating').unsigned().nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('body_soreness_rating');
        });
    }
}
//# sourceMappingURL=1766137381418_alter_body_sorenesses_table.js.map