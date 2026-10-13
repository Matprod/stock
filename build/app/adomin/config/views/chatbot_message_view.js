import { createModelViewConfig } from '#adomin/create_model_view_config';
import ChatbotMessage from '#models_pg/chatbot_message';
import { createRoleVisibilityCheck } from '../utils.js';
export const CHATBOT_MESSAGE_VIEW = createModelViewConfig(() => ChatbotMessage, {
    label: 'Messages Chatbot',
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
        content: {
            type: 'string',
            label: 'Contenu',
        },
        author: {
            type: 'enum',
            options: [
                { label: 'Utilisateur', value: 'user' },
                { label: 'Bot', value: 'bot' },
            ],
            label: 'Auteur',
        },
        chatbotDiscussion: {
            type: 'belongsToRelation',
            label: 'Discussion',
            modelName: 'ChatbotDiscussion',
            labelFields: ['id'],
        },
        updatedAt: {
            type: 'date',
            subType: 'datetime',
            editable: false,
            creatable: false,
            label: 'Date de mise à jour',
        },
    },
});
//# sourceMappingURL=chatbot_message_view.js.map