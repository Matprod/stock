import string from '@adonisjs/core/helpers/string';
import db from '@adonisjs/lucid/services/db';
import { createModelViewConfig } from '#adomin/create_model_view_config';
import SubjectiveScaleConfig from '#models_pg/subjective_field_config';
import ClubSubjectiveScaleSeedService from '#services/club_subjective_scale_seed_service';
import { SUBJECTIVE_VARIABLE_DOMAIN, SUBJECTIVE_VARIABLE_DOMAINS, } from '#contracts/subjective_variable';
import { createRoleVisibilityCheck } from '../utils.js';
const DOMAIN_LABELS = {
    [SUBJECTIVE_VARIABLE_DOMAIN.SPORT_ACTIVITY]: 'Sport activity',
    [SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_RATING]: 'Health rating',
    [SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC]: 'Health metric',
    [SUBJECTIVE_VARIABLE_DOMAIN.SLEEP]: 'Sleep',
};
const DOMAIN_DB_RULES = {
    [SUBJECTIVE_VARIABLE_DOMAIN.SPORT_ACTIVITY]: {
        kind: 'numeric_column',
        table: 'sport_activities',
    },
    [SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_RATING]: {
        kind: 'numeric_column',
        table: 'health_ratings',
    },
    [SUBJECTIVE_VARIABLE_DOMAIN.SLEEP]: {
        kind: 'numeric_column',
        table: 'sleeps',
    },
    [SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC]: {
        kind: 'named_row',
        table: 'health_metrics',
        nameColumn: 'name',
    },
};
const INTEGER_COLUMN_TYPES = new Set(['integer', 'smallint', 'bigint']);
const assertDomain = (domain) => {
    if (!Object.values(SUBJECTIVE_VARIABLE_DOMAIN).includes(domain)) {
        throw new Error(`Invalid domain "${domain}". Expected one of: ${Object.values(SUBJECTIVE_VARIABLE_DOMAIN).join(', ')}`);
    }
    return domain;
};
const normalizeFieldName = (fieldName, domain) => {
    const trimmed = fieldName.trim();
    if (!trimmed)
        return trimmed;
    if (domain === SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC) {
        return trimmed;
    }
    return string.snakeCase(trimmed);
};
const assertNumericColumnExists = async (tableName, columnName) => {
    const row = await db
        .from('information_schema.columns')
        .select('column_name', 'data_type')
        .where('table_schema', 'public')
        .where('table_name', tableName)
        .where('column_name', columnName)
        .first();
    if (!row) {
        throw new Error(`field_name "${columnName}" does not exist on table ${tableName}`);
    }
    if (!INTEGER_COLUMN_TYPES.has(row.data_type)) {
        throw new Error(`column "${columnName}" on ${tableName} is not an integer (type: ${row.data_type})`);
    }
};
const assertNamedRowExists = async (tableName, nameColumn, value) => {
    const row = await db.from(tableName).where(nameColumn, value).first();
    if (!row) {
        throw new Error(`field_name "${value}" does not exist in ${tableName}.${nameColumn}`);
    }
};
const assertFieldExistsInDatabase = async (domain, fieldName) => {
    const rule = DOMAIN_DB_RULES[domain];
    if (rule.kind === 'numeric_column') {
        await assertNumericColumnExists(rule.table, fieldName);
        return;
    }
    await assertNamedRowExists(rule.table, rule.nameColumn, fieldName);
};
const validateAndNormalizeFieldName = async (fieldName, domain) => {
    const parsedDomain = assertDomain(domain);
    const normalizedFieldName = normalizeFieldName(fieldName, parsedDomain);
    if (!normalizedFieldName) {
        throw new Error('field_name is required');
    }
    await assertFieldExistsInDatabase(parsedDomain, normalizedFieldName);
    return normalizedFieldName;
};
export const SUBJECTIVE_SCALE_CONFIG_VIEW = createModelViewConfig(() => SubjectiveScaleConfig, {
    label: 'Subjective scale config',
    icon: 'adjustments',
    visibilityCheck: createRoleVisibilityCheck([]),
    afterValidatePayloadTransformCallback: async (payload) => {
        const fieldName = await validateAndNormalizeFieldName(payload.fieldName, payload.domain);
        return {
            ...payload,
            fieldName,
        };
    },
    instanceActions: [
        {
            icon: 'terminal-2',
            name: 'generate-seed',
            type: 'backend-action',
            tooltip: 'Seed labels/help translations from catalogue',
            action: async (ctx) => {
                try {
                    const result = await new ClubSubjectiveScaleSeedService().seedConfigFromCatalogue(ctx.params.id);
                    return ctx.response.ok({
                        message: `Seeded ${result.seededKeys.join(', ')} — translations: ${result.translationsCreated} created, ${result.translationsUpdated} updated`,
                    });
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : 'Seed failed';
                    return ctx.response.badRequest({ error: message });
                }
            },
        },
    ],
    columns: {
        club: {
            type: 'belongsToRelation',
            label: 'Club',
            modelName: 'Club',
            labelFields: ['name'],
            preload: true,
        },
        domain: {
            type: 'enum',
            label: 'Domain',
            options: SUBJECTIVE_VARIABLE_DOMAINS.map((value) => ({
                label: DOMAIN_LABELS[value] ?? value,
                value,
            })),
        },
        fieldName: {
            type: 'string',
            label: 'Field name',
        },
        minScale: {
            type: 'number',
            label: 'Min scale',
            defaultValue: 1,
        },
        maxScale: {
            type: 'number',
            label: 'Max scale',
            defaultValue: 10,
        },
        isReversed: {
            type: 'boolean',
            label: 'Scale inversee',
            defaultValue: false,
        },
        gap: {
            type: 'number',
            label: 'Gap',
            nullable: true,
            optional: true,
            min: 1,
            defaultValue: 1,
        },
    },
});
//# sourceMappingURL=subjective_scale_config_view.js.map