import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_reinforcementexercices';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('video_link').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('video_link');
        });
    }
}
//# sourceMappingURL=1757599610331_alter_add_video_links_table.js.map