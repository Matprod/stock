import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'clubs';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('name').notNullable();
            table.uuid('sport_id').notNullable().references('id').inTable('sports').onDelete('RESTRICT');
            table.date('start_date').nullable();
            table.date('end_date').nullable();
            table
                .enum('language', ['en', 'fr'], {
                useNative: true,
                enumName: 'language_enum',
                existingType: false,
            })
                .defaultTo('en');
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTableIfExists(this.tableName);
        this.schema.raw('DROP TYPE IF EXISTS language_enum');
    }
}
//# sourceMappingURL=1777989055821_create_clubs_table.js.map