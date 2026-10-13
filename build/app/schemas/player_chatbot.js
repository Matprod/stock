import vine from '@vinejs/vine';
export const playerChatbotSchema = vine.compile(vine.object({
    date: vine.string(),
    prompt: vine.string(),
    discussionId: vine.string().optional(),
    category: vine.string().optional(),
    athlete_id: vine.string().optional(),
}));
//# sourceMappingURL=player_chatbot.js.map