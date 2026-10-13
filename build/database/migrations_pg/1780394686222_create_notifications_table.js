import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'notifications';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('title').notNullable();
            table.date('date').nullable();
            table
                .enum('day', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], {
                useNative: true,
                enumName: 'day_enum',
                existingType: false,
            })
                .nullable();
            table.time('time').notNullable();
            table.uuid('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
        this.schema.raw('DROP TYPE IF EXISTS day_enum');
    }
}
//# sourceMappingURL=1780394686222_create_notifications_table.js.map