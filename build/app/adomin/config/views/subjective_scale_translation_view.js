import { createModelViewConfig } from '#adomin/create_model_view_config';
import { createRoleVisibilityCheck } from '../utils.js';
import SubjectiveScaleTranslation from '#models/subjective_scale_translation';
import { TRANSLATABLE_TYPES } from '#constants/translation.constants';
import { SUBJECTIVE_VARIABLE_LEVEL_TRANSLATION_KEY_OPTIONS, SUBJECTIVE_VARIABLE_TRANSLATION_KEY_OPTIONS, } from '#constants/subjective_translation.constants';
export const SUBJECTIVE_SCALE_TRANSLATION_VIEW = createModelViewConfig(() => SubjectiveScaleTranslation, {
    label: 'Subjective scale translation',
    icon: 'language',
    visibilityCheck: createRoleVisibilityCheck([]),
    queryBuilderCallback: (query) => query.where('translatable_type', TRANSLATABLE_TYPES.SUBJECTIVE_VARIABLE),
    afterValidatePayloadTransformCallback: async (payload) => ({
        ...payload,
        translatableType: TRANSLATABLE_TYPES.SUBJECTIVE_VARIABLE,
    }),
    columns: {
        id: {
            type: 'string',
            label: 'ID',
            creatable: false,
            editable: false,
        },
        language: {
            type: 'enum',
            label: 'Langue',
            options: [
                { label: 'FR', value: 'fr' },
                { label: 'EN', value: 'en' },
            ],
        },
        translatableId: {
            type: 'string',
            label: 'Subjective scale config ID',
        },
        translatableType: {
            type: 'enum',
            label: 'Type',
            options: [{ label: 'Subjective scale config', value: TRANSLATABLE_TYPES.SUBJECTIVE_VARIABLE }],
            creatable: false,
            editable: false,
            isVisible: async () => false,
        },
        key: {
            type: 'enum',
            label: 'Clé',
            options: [
                ...SUBJECTIVE_VARIABLE_TRANSLATION_KEY_OPTIONS,
                ...SUBJECTIVE_VARIABLE_LEVEL_TRANSLATION_KEY_OPTIONS,
            ],
        },
        value: {
            type: 'string',
            label: 'Traduction',
            size: 500,
        },
        createdAt: {
            type: 'date',
            subType: 'datetime',
            label: 'Création',
            isVisible: async () => false,
        },
        updatedAt: {
            type: 'date',
            subType: 'datetime',
            label: 'Mise à jour',
            isVisible: async () => false,
        },
    },
});
//# sourceMappingURL=subjective_scale_translation_view.js.map