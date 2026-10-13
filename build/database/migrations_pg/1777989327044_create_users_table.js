import { USER_ROLE } from '#constants/user.constants';
import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'users';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('email').notNullable().unique();
            table.string('password').notNullable();
            table
                .enum('role', Object.values(USER_ROLE), {
                useNative: true,
                enumName: 'user_role_enum',
                existingType: false,
            })
                .defaultTo(USER_ROLE.CLUB_STAFF);
            table.string('default_page').nullable();
            table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTableIfExists(this.tableName);
        this.schema.raw('DROP TYPE IF EXISTS user_role_enum');
    }
}
//# sourceMappingURL=1777989327044_create_users_table.js.map