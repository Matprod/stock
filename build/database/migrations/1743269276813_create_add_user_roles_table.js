import { BaseSchema } from '@adonisjs/lucid/schema';
import { USER_ROLE } from '#constants/user.constants';
export default class extends BaseSchema {
    tableName = 'users';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('role', Object.values(USER_ROLE)).defaultTo(USER_ROLE.CLUB_STAFF);
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('role');
        });
    }
}
//# sourceMappingURL=1743269276813_create_add_user_roles_table.js.map