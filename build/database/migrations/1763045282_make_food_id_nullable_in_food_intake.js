import { BaseSchema } from '@adonisjs/lucid/schema';
export default class MakeFoodIdNullableInFoodIntake extends BaseSchema {
    tableName = 'sportactivity_foodintake';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.bigInteger('food_id').nullable().alter();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.bigInteger('food_id').notNullable().alter();
        });
    }
}
//# sourceMappingURL=1763045282_make_food_id_nullable_in_food_intake.js.map