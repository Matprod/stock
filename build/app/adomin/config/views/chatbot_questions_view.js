import { createModelViewConfig } from '#adomin/create_model_view_config';
import ChatbotQuestions from '#models_pg/chatbot_questions';
import { CHATBOT_QUESTION_CATEGORY, CHATBOT_QUESTION_TYPE, } from '#constants/chatbot_questions.constants';
import { createRoleVisibilityCheck } from '../utils.js';
export const CHATBOT_QUESTIONS_VIEW = createModelViewConfig(() => ChatbotQuestions, {
    label: 'Questions Chatbot',
    icon: 'question-mark',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        author: {
            type: 'enum',
            label: 'Author',
            options: [
                { value: CHATBOT_QUESTION_TYPE.ATHLETE, label: 'Athlete' },
                { value: CHATBOT_QUESTION_TYPE.TEAM, label: 'Team' },
                { value: CHATBOT_QUESTION_TYPE.USER, label: 'User' },
            ],
        },
        question: {
            type: 'string',
            multiline: true,
            label: 'Question',
        },
        title: {
            type: 'string',
            label: 'Title',
        },
        category: {
            type: 'enum',
            label: 'Category',
            optional: true,
            nullable: true,
            options: [
                { value: CHATBOT_QUESTION_CATEGORY.PERFORMANCE, label: 'Performance' },
                { value: CHATBOT_QUESTION_CATEGORY.INJURY, label: 'Injury' },
            ],
        },
        order: {
            type: 'number',
            label: 'Order',
            optional: true,
            nullable: true,
        },
        club: {
            type: 'belongsToRelation',
            label: 'Club',
            modelName: 'Club',
            labelFields: ['name'],
            optional: true,
        },
    },
});
//# sourceMappingURL=chatbot_questions_view.js.map