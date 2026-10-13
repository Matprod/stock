import { BaseSchema } from '@adonisjs/lucid/schema';
export default class extends BaseSchema {
    tableName = 'sport_activities';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('data_source').notNullable();
            table.float('distance').nullable();
            table.float('speed').nullable();
            table.integer('duration_seconds').nullable();
            table.float('elevation').nullable();
            table.float('power').nullable();
            table.integer('averaged_bpm').nullable();
            table.integer('rpe').nullable();
            table.integer('fitness_level').nullable();
            table.integer('cardio_respiratory').nullable();
            table.integer('muscular_difficulty').nullable();
            table.time('time_of_activity').nullable();
            table.integer('fatigue_level').nullable();
            table.integer('pleasure_level').nullable();
            table.integer('active_calories').nullable();
            table.integer('cadence').nullable();
            table.integer('elevation_descent').nullable();
            table.decimal('training_load', 10, 2).nullable();
            table.boolean('game_activity').nullable().defaultTo(false);
            table.integer('fc_max').nullable();
            table
                .uuid('workout_session_instance_id')
                .nullable()
                .references('id')
                .inTable('workout_session_instances')
                .onDelete('SET NULL');
            table.uuid('event_id').nullable().references('id').inTable('events').onDelete('SET NULL');
            table.uuid('day_id').nullable().references('id').inTable('days').onDelete('SET NULL');
            table
                .uuid('activity_type_id')
                .nullable()
                .references('id')
                .inTable('activities')
                .onDelete('SET NULL');
            table.timestamps(true, true);
            table.check('distance >= 0', [], 'check_distance');
            table.check('speed >= 0', [], 'check_speed');
            table.check('duration_seconds >= 0', [], 'check_duration');
            table.check('elevation >= 0', [], 'check_elevation');
            table.check('power >= 0', [], 'check_power');
            table.check('averaged_bpm >= 0', [], 'check_averaged_bpm');
            table.check('rpe >= 0', [], 'check_rpe');
            table.check('fitness_level >= 0', [], 'check_fitness_level');
            table.check('cardio_respiratory >= 0', [], 'check_cardio_respiratory');
            table.check('muscular_difficulty >= 0', [], 'check_muscular_difficulty');
            table.check('fatigue_level >= 0', [], 'check_fatigue_level');
            table.check('pleasure_level >= 0', [], 'check_pleasure_level');
            table.check('active_calories >= 0', [], 'check_active_calories');
            table.check('cadence >= 0', [], 'check_cadence');
            table.check('elevation_descent >= 0', [], 'check_elevation_descent');
            table.check('training_load >= 0', [], 'check_training_load');
            table.check('fc_max >= 0', [], 'check_fc_max');
            table.unique(['day_id', 'activity_type_id', 'time_of_activity']);
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1780317458691_create_sport_activities_table.js.map