import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'zones';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table
                .enum('side', ['front', 'back'], {
                useNative: true,
                enumName: 'zones_side_enum',
                existingType: false,
            })
                .notNullable();
            table.string('name').nullable();
            table.timestamps(true, true);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
        this.schema.raw('DROP TYPE IF EXISTS zones_side_enum');
    }
}
//# sourceMappingURL=1780406963215_create_zones_table.js.map