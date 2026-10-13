import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'chatbot_discussions';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('title').notNullable();
            table
                .enum('category', ['performance', 'injury'], {
                useNative: true,
                enumName: 'prediction_type_enum',
                existingType: true,
            })
                .nullable();
            table.date('discussion_day').notNullable();
            table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
            table
                .uuid('athlete_id')
                .references('id')
                .inTable('athletes')
                .onDelete('CASCADE')
                .nullable();
            table.timestamps(true, true);
            table.index(['athlete_id', 'user_id', 'discussion_day']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780579010964_create_chatbot_discussions_table.js.map