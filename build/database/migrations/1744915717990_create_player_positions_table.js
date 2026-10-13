import { BaseSchema } from '@adonisjs/lucid/schema';
export default class CreatePlayerPositionsTable extends BaseSchema {
    tableName = 'player_positions';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.string('name').notNullable();
            table.bigint('sport_id').notNullable().references('id').inTable('base_sport');
            table.unique(['name', 'sport_id']);
            table.timestamps(true);
        });
        await this.defer(async (db) => {
            await db.table(this.tableName).insert([
                { name: 'GOALKEEPER', sport_id: 5 },
                { name: 'DEFENDER', sport_id: 5 },
                { name: 'MIDFIELDER', sport_id: 5 },
                { name: 'FORWARD', sport_id: 5 }
            ]);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1744915717990_create_player_positions_table.js.map