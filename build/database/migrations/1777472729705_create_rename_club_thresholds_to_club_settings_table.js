import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    fromTableName = 'club_thresholds';
    toTableName = 'club_settings';
    async up() {
        this.schema.renameTable(this.fromTableName, this.toTableName);
    }
    async down() {
        this.schema.renameTable(this.toTableName, this.fromTableName);
    }
}
//# sourceMappingURL=1777472729705_create_rename_club_thresholds_to_club_settings_table.js.map