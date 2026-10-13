import { CHATBOT_QUESTION_TYPE } from '#constants/chatbot_questions.constants';
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS, } from '#constants/translation.constants';
import ChatbotQuestions from '#models_pg/chatbot_questions';
import { TranslationService } from '#services/translation_service';
import { shuffleArray } from '../utils/array.js';
export default class ChatbotQuestionsService {
    translationService;
    constructor() {
        this.translationService = new TranslationService();
    }
    async getQuestionsByClub(clubId, category, limit = 4, language) {
        const questions = await this.getAthleteQuestionPool(clubId, category);
        return this.formatQuestions(questions, limit, language);
    }
    async getTeamQuestions(clubId, limit = 4, language) {
        const questions = await this.getTeamQuestionPool(clubId);
        return this.formatQuestions(questions, limit, language);
    }
    async getQuestions(clubId, type = CHATBOT_QUESTION_TYPE.ATHLETE, category, limit = 4, language) {
        if (type === CHATBOT_QUESTION_TYPE.TEAM) {
            return this.getTeamQuestions(clubId, limit, language);
        }
        if (!category) {
            throw new Error('category is required for athlete questions');
        }
        return this.getQuestionsByClub(clubId, category, limit, language);
    }
    async getAthleteQuestionPool(clubId, category) {
        const clubQuestions = await ChatbotQuestions.query()
            .where('author', CHATBOT_QUESTION_TYPE.ATHLETE)
            .where('category', category)
            .if(clubId, (query) => query.where('clubId', clubId))
            .if(!clubId, (query) => query.whereNull('clubId'));
        if (!clubId || clubQuestions.length > 0) {
            return clubQuestions;
        }
        return ChatbotQuestions.query()
            .where('author', CHATBOT_QUESTION_TYPE.ATHLETE)
            .where('category', category)
            .whereNull('clubId');
    }
    async getTeamQuestionPool(clubId) {
        const clubQuestions = await ChatbotQuestions.query()
            .where('author', CHATBOT_QUESTION_TYPE.TEAM)
            .if(clubId, (query) => query.where('clubId', clubId))
            .if(!clubId, (query) => query.whereNull('clubId'));
        if (!clubId || clubQuestions.length > 0) {
            return clubQuestions;
        }
        return ChatbotQuestions.query().where('author', CHATBOT_QUESTION_TYPE.TEAM).whereNull('clubId');
    }
    async formatQuestions(questions, limit, language) {
        const selectedQuestions = this.selectAndOrderQuestions(questions, limit);
        const questionIds = selectedQuestions.map((q) => q.id);
        const [titleMap, textMap] = await Promise.all([
            this.translationService.getTranslations(TRANSLATABLE_TYPES.CHATBOT_QUESTION, TRANSLATION_KEYS.CHATBOT_QUESTION_TITLE, questionIds, language),
            this.translationService.getTranslations(TRANSLATABLE_TYPES.CHATBOT_QUESTION, TRANSLATION_KEYS.CHATBOT_QUESTION_TEXT, questionIds, language),
        ]);
        return selectedQuestions.map((q) => ({
            id: q.id,
            question: textMap.get(q.id) ?? q.question,
            title: titleMap.get(q.id) ?? q.title,
            category: q.category,
        }));
    }
    selectAndOrderQuestions(questions, limit) {
        const questionsWithOrder = questions
            .filter((q) => q.order && q.order > 0)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const questionsWithoutOrder = questions.filter((q) => !q.order || q.order <= 0);
        shuffleArray(questionsWithoutOrder);
        return [...questionsWithOrder, ...questionsWithoutOrder].slice(0, limit);
    }
}
//# sourceMappingURL=chatbot_questions_service.js.map