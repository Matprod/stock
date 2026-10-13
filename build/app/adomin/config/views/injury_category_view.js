import { createModelViewConfig } from '#adomin/create_model_view_config';
import InjurySection from '#models_pg/injury_section';
export const INJURY_CATEGORY_VIEW = createModelViewConfig(() => InjurySection, {
    label: 'Catégories de blessures',
    icon: 'bone',
    isHidden: true,
    columns: {
        name: {
            type: 'string',
            label: 'Name',
        },
    },
});
//# sourceMappingURL=injury_category_view.js.map