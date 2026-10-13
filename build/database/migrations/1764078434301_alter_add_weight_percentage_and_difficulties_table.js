import { EXERCISE_DIFFICULTY } from '#constants/workout.constants';
import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sportactivity_reinforcementexercices';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.enum('difficulty', Object.values(EXERCISE_DIFFICULTY)).nullable();
            table.integer('estimated_reps').nullable();
            table.integer('estimated_duration').nullable();
            table.integer('bodyweight_percentage').nullable();
        });
    }
    async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('difficulty');
            table.dropColumn('estimated_reps');
            table.dropColumn('estimated_duration');
            table.dropColumn('bodyweight_percentage');
        });
    }
}
//# sourceMappingURL=1764078434301_alter_add_weight_percentage_and_difficulties_table.js.map