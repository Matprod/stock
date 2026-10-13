import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'athlete_providers';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('provider_athlete_id').nullable();
            table.string('provider').nullable();
            table.string('access_token').nullable();
            table.string('access_token_secret').nullable();
            table.string('refresh_token').nullable();
            table.timestamp('token_expires_at').nullable();
            table
                .uuid('athlete_id')
                .references('id')
                .inTable('athletes')
                .onDelete('CASCADE')
                .notNullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780581541948_create_athlete_providers_table.js.map