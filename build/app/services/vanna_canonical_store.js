import { getNextCanonicalPrompt } from '#services/vanna_prompt_utils';
const canonicalByDiscussionId = new Map();
export function getCanonicalPrompt(discussionId) {
    return canonicalByDiscussionId.get(discussionId) ?? null;
}
export function updateCanonicalPrompt(discussionId, prompt) {
    const current = getCanonicalPrompt(discussionId);
    const next = getNextCanonicalPrompt(current, prompt);
    canonicalByDiscussionId.set(discussionId, next);
    return next;
}
export function clearCanonicalPrompt(discussionId) {
    canonicalByDiscussionId.delete(discussionId);
}
//# sourceMappingURL=vanna_canonical_store.js.map