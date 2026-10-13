import { BaseSchema } from '@adonisjs/lucid/schema';
import { SUBJECTIVE_VARIABLE_DOMAINS } from '#contracts/subjective_variable';
export default class extends BaseSchema {
    tableName = 'subjective_field_configs';
    async up() {
        this.schema.alterTable(this.tableName, (table) => {
            table.string('field_name').nullable();
            table
                .enum('domain', SUBJECTIVE_VARIABLE_DOMAINS, {
                useNative: true,
                existingType: true,
                enumName: 'subjective_variable_domain_enum',
            })
                .nullable();
        });
        this.defer(async (db) => {
            await db.rawQuery(`
        UPDATE subjective_field_configs AS config
        SET
          field_name = variable.field_name,
          domain = variable.domain
        FROM subjective_variables AS variable
        WHERE config.subjective_variable_id = variable.id
          AND (config.field_name IS NULL OR config.domain IS NULL)
      `);
            await db.rawQuery(`
        UPDATE subjective_field_configs
        SET
          domain = CASE field_id
            WHEN 'rpe' THEN 'sport_activity'::subjective_variable_domain_enum
            WHEN 'muscularDifficulty' THEN 'sport_activity'::subjective_variable_domain_enum
            WHEN 'cardioRespiratory' THEN 'sport_activity'::subjective_variable_domain_enum
            WHEN 'pleasureLevel' THEN 'sport_activity'::subjective_variable_domain_enum
            WHEN 'fatigueLevel' THEN 'sport_activity'::subjective_variable_domain_enum
            WHEN 'sleepQuality' THEN 'sleep'::subjective_variable_domain_enum
            WHEN 'energy' THEN 'health_rating'::subjective_variable_domain_enum
            WHEN 'stress' THEN 'health_rating'::subjective_variable_domain_enum
            WHEN 'mood' THEN 'health_rating'::subjective_variable_domain_enum
            WHEN 'wellbeing' THEN 'health_rating'::subjective_variable_domain_enum
            WHEN 'bodySoreness' THEN 'health_rating'::subjective_variable_domain_enum
            WHEN 'Training RPE' THEN 'health_metric'::subjective_variable_domain_enum
            WHEN 'training_rpe' THEN 'health_metric'::subjective_variable_domain_enum
            WHEN 'PRE training RPE' THEN 'health_metric'::subjective_variable_domain_enum
            WHEN 'pre_training_rpe' THEN 'health_metric'::subjective_variable_domain_enum
            WHEN 'Post Training RPE' THEN 'health_metric'::subjective_variable_domain_enum
            WHEN 'post_training_rpe' THEN 'health_metric'::subjective_variable_domain_enum
            WHEN 'AT/IT/RT RPE' THEN 'health_metric'::subjective_variable_domain_enum
            WHEN 'at_it_rt_rpe' THEN 'health_metric'::subjective_variable_domain_enum
            ELSE domain
          END,
          field_name = CASE field_id
            WHEN 'rpe' THEN 'rpe'
            WHEN 'muscularDifficulty' THEN 'muscular_difficulty'
            WHEN 'cardioRespiratory' THEN 'cardio_respiratory'
            WHEN 'pleasureLevel' THEN 'pleasure_level'
            WHEN 'fatigueLevel' THEN 'fatigue_level'
            WHEN 'sleepQuality' THEN 'quality_rating'
            WHEN 'energy' THEN 'energy_rating'
            WHEN 'stress' THEN 'stress_rating'
            WHEN 'mood' THEN 'mood_rating'
            WHEN 'wellbeing' THEN 'wellbeing_rating'
            WHEN 'bodySoreness' THEN 'body_soreness_rating'
            WHEN 'Training RPE' THEN 'Training RPE'
            WHEN 'training_rpe' THEN 'Training RPE'
            WHEN 'PRE training RPE' THEN 'PRE training RPE'
            WHEN 'pre_training_rpe' THEN 'PRE training RPE'
            WHEN 'Post Training RPE' THEN 'Post Training RPE'
            WHEN 'post_training_rpe' THEN 'Post Training RPE'
            WHEN 'AT/IT/RT RPE' THEN 'AT/IT/RT RPE'
            WHEN 'at_it_rt_rpe' THEN 'AT/IT/RT RPE'
            ELSE field_name
          END
        WHERE field_name IS NULL OR domain IS NULL
      `);
            const unresolved = await db
                .from(this.tableName)
                .whereNull('field_name')
                .orWhereNull('domain')
                .select('id', 'field_id');
            if (unresolved.length > 0) {
                const fieldIds = unresolved.map((row) => row.field_id).join(', ');
                throw new Error(`Cannot flatten subjective_field_configs: ${unresolved.length} row(s) still missing domain/field_name (field_id: ${fieldIds})`);
            }
        });
        this.schema.alterTable(this.tableName, (table) => {
            table.dropUnique(['club_id', 'subjective_variable_id']);
            table.dropUnique(['club_id', 'field_id']);
            table.dropColumn('subjective_variable_id');
            table.dropColumn('field_id');
        });
        this.schema.alterTable(this.tableName, (table) => {
            table.string('field_name').notNullable().alter();
            table
                .enum('domain', SUBJECTIVE_VARIABLE_DOMAINS, {
                useNative: true,
                existingType: true,
                enumName: 'subjective_variable_domain_enum',
            })
                .notNullable()
                .alter();
            table.unique(['club_id', 'domain', 'field_name']);
        });
        this.schema.dropTable('subjective_variables');
    }
    async down() {
        this.schema.createTable('subjective_variables', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'));
            table.string('field_name').notNullable();
            table
                .enum('domain', SUBJECTIVE_VARIABLE_DOMAINS, {
                useNative: true,
                existingType: true,
                enumName: 'subjective_variable_domain_enum',
            })
                .notNullable();
            table.timestamps(true, true);
            table.unique(['domain', 'field_name']);
        });
        this.defer(async (db) => {
            await db.rawQuery(`
        INSERT INTO subjective_variables (id, field_name, domain, created_at, updated_at)
        SELECT DISTINCT ON (domain, field_name)
          uuidv7(),
          field_name,
          domain,
          NOW(),
          NOW()
        FROM subjective_field_configs
        ORDER BY domain, field_name
      `);
        });
        this.schema.alterTable(this.tableName, (table) => {
            table.dropUnique(['club_id', 'domain', 'field_name']);
            table
                .uuid('subjective_variable_id')
                .nullable()
                .references('id')
                .inTable('subjective_variables')
                .onDelete('CASCADE');
            table.string('field_id').nullable();
        });
        this.defer(async (db) => {
            await db.rawQuery(`
        UPDATE subjective_field_configs AS config
        SET
          subjective_variable_id = variable.id,
          field_id = CASE
            WHEN config.domain = 'sleep' AND config.field_name = 'quality_rating' THEN 'sleepQuality'
            WHEN config.domain = 'health_rating' AND config.field_name = 'energy_rating' THEN 'energy'
            WHEN config.domain = 'health_rating' AND config.field_name = 'stress_rating' THEN 'stress'
            WHEN config.domain = 'health_rating' AND config.field_name = 'mood_rating' THEN 'mood'
            WHEN config.domain = 'health_rating' AND config.field_name = 'wellbeing_rating' THEN 'wellbeing'
            WHEN config.domain = 'health_rating' AND config.field_name = 'body_soreness_rating' THEN 'bodySoreness'
            WHEN config.domain = 'health_metric' THEN config.field_name
            WHEN config.domain = 'sport_activity' AND config.field_name = 'rpe' THEN 'rpe'
            WHEN config.domain = 'sport_activity' AND config.field_name = 'muscular_difficulty' THEN 'muscularDifficulty'
            WHEN config.domain = 'sport_activity' AND config.field_name = 'cardio_respiratory' THEN 'cardioRespiratory'
            WHEN config.domain = 'sport_activity' AND config.field_name = 'pleasure_level' THEN 'pleasureLevel'
            WHEN config.domain = 'sport_activity' AND config.field_name = 'fatigue_level' THEN 'fatigueLevel'
            ELSE config.field_name
          END
        FROM subjective_variables AS variable
        WHERE config.domain = variable.domain
          AND config.field_name = variable.field_name
      `);
        });
        this.schema.alterTable(this.tableName, (table) => {
            table.dropColumn('domain');
            table.dropColumn('field_name');
            table.string('field_id').notNullable().alter();
            table.unique(['club_id', 'field_id']);
            table.unique(['club_id', 'subjective_variable_id']);
        });
    }
}
//# sourceMappingURL=1788512088222_flatten_subjective_field_configs.js.map