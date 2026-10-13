import { createModelViewConfig } from '#adomin/create_model_view_config';
import ChatbotDiscussion from '#models_pg/chatbot_discussion';
import { createRoleVisibilityCheck } from '../utils.js';
export const CHATBOT_DISCUSSION_VIEW = createModelViewConfig(() => ChatbotDiscussion, {
    label: 'Discussions Chatbot',
    icon: 'message',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        createdAt: {
            type: 'date',
            subType: 'datetime',
            editable: false,
            creatable: false,
            label: 'Date de création',
        },
        athlete: {
            type: 'belongsToRelation',
            label: 'Athlete (Athlete chatbot)',
            modelName: 'Athlete',
            labelFields: ['name'],
            optional: true,
        },
        discussionDay: {
            type: 'date',
            subType: 'date',
            label: 'Date de discussion',
        },
        user: {
            type: 'belongsToRelation',
            label: 'Utilisateur',
            modelName: 'User',
            labelFields: ['email'],
        },
        messages: {
            type: 'hasManyRelation',
            label: 'Messages',
            modelName: 'ChatbotMessage',
            labelFields: ['content'],
        },
    },
});
//# sourceMappingURL=chatbot_discussion_view.js.map