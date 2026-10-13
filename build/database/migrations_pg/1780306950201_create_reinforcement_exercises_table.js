import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'reinforcement_exercises';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('name').notNullable();
            table
                .enum('type', ['bodyweight_reps', 'bodyweight_time', 'weighted_reps', 'weighted_time'], {
                useNative: true,
                enumName: 'reinforcement_exercise_type_enum',
                existingType: false,
            })
                .defaultTo('bodyweight_reps')
                .notNullable();
            table
                .enum('difficulty', ['easy', 'medium', 'hard', 'very_hard'], {
                useNative: true,
                enumName: 'reinforcement_exercise_difficulty_enum',
                existingType: false,
            })
                .nullable();
            table.string('video_link').nullable();
            table.integer('estimated_reps').nullable();
            table.integer('estimated_duration').nullable();
            table.integer('bodyweight_percentage').nullable();
            table.uuid('club_id').references('id').inTable('clubs').onDelete('CASCADE');
            table
                .uuid('activity_id')
                .notNullable()
                .references('id')
                .inTable('activities')
                .onDelete('CASCADE');
            table.timestamps(true, true);
            table.index(['club_id', 'name']);
            table.unique(['club_id', 'name']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
        this.schema.raw('DROP TYPE IF EXISTS reinforcement_exercise_type_enum');
        this.schema.raw('DROP TYPE IF EXISTS reinforcement_exercise_difficulty_enum');
    }
}
//# sourceMappingURL=1780306950201_create_reinforcement_exercises_table.js.map