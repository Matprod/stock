import { createModelViewConfig } from '#adomin/create_model_view_config';
import NotificationMessage from '#models_pg/notification_message';
import { createRoleVisibilityCheck } from '../utils.js';
export const MESSAGE_VIEW = createModelViewConfig(() => NotificationMessage, {
    label: 'Messages',
    icon: 'message-circle',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        title: {
            type: 'string',
            label: 'Titre',
            multiline: true,
        },
        content: {
            type: 'string',
            label: 'Contenu',
            multiline: true,
            optional: true,
        },
        notifications: {
            type: 'manyToManyRelation',
            label: 'Notifications',
            modelName: 'Notification',
            labelFields: ['title'],
            preload: true,
            pivotTable: 'notification_message_links',
            optional: true,
        },
    },
});
//# sourceMappingURL=message_view.js.map