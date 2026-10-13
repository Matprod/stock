import { createModelViewConfig } from '#adomin/create_model_view_config';
import { INSIGHT_TRESHOLD_TYPE } from '#constants/insight.constants';
import { createRoleVisibilityCheck } from '../utils.js';
import Insight from '#models_pg/insight';
export const INSIGHT_VIEW = createModelViewConfig(() => Insight, {
    label: 'Insights',
    icon: 'alert-small',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        variableName: {
            type: 'string',
            label: 'Variable',
        },
        name: {
            type: 'string',
            label: 'Nom',
            size: 300,
        },
        description: {
            type: 'string',
            multiline: true,
            label: 'Description',
            size: 500,
        },
        maximum: {
            type: 'number',
            label: 'Maximum value',
            optional: true,
        },
        tresholdLow: {
            type: 'number',
            label: 'Treshold Low',
            optional: true,
        },
        tresholdTooLow: {
            type: 'number',
            label: 'Treshold Too Low',
            optional: true,
        },
        tresholdHigh: {
            type: 'number',
            label: 'Treshold High',
            optional: true,
        },
        tresholdTooHigh: {
            type: 'number',
            label: 'Treshold Too High',
            optional: true,
        },
        tresholdType: {
            type: 'enum',
            label: 'Treshold Type',
            options: [
                { label: 'Absolu', value: INSIGHT_TRESHOLD_TYPE.ABSOLUTE },
                { label: 'Pourcentage', value: INSIGHT_TRESHOLD_TYPE.PERCENTAGE },
            ],
            optional: true,
        },
        clubs: {
            type: 'manyToManyRelation',
            label: 'Clubs',
            modelName: 'Club',
            labelFields: ['name'],
            preload: true,
            pivotTable: 'club_insights',
        },
    },
});
//# sourceMappingURL=insight_view.js.map