import { createModelViewConfig } from '#adomin/create_model_view_config';
import Zone from '#models_pg/zone';
export const ZONE_VIEW = createModelViewConfig(() => Zone, {
    label: 'Zones de douleur',
    icon: 'bone',
    isHidden: true,
    columns: {
        name: {
            type: 'string',
            label: 'Nom',
        },
        side: {
            type: 'string',
            label: 'Côté',
        },
    },
});
//# sourceMappingURL=zone_view.js.map