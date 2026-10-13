export function normalizePrompt(text) {
    return text.trim().toLowerCase();
}
export function isFeedbackOrCorrectionPrompt(prompt) {
    const t = normalizePrompt(prompt);
    if (!t)
        return true;
    if (t.length <= 8)
        return true;
    const feedback = [
        'merci',
        'ok',
        'okay',
        'okey',
        'okeyy',
        'thanks',
        'thank you',
        'thx',
        'super',
        'parfait',
        "c'est bon",
        'top',
        'nickel',
        'great',
        'perfect',
    ];
    if (feedback.some((w) => t === w))
        return true;
    const correctionMarkers = [
        "c'est faux",
        'faux',
        "tu te trompes",
        "tu n'as pas compris",
        "t'as pas compris",
        'ça répond pas',
        'ça ne répond pas',
        'refais',
        'corrige',
        'recommence',
        "je voulais dire",
        "en fait",
        "c'est pas possible",
        'impossible',
        "it's wrong",
        "that's wrong",
        'wrong',
        "it's not possible",
        'not possible',
        'impossible',
        'still not possible',
        "you didn't understand",
        "doesn't make sense",
        "that doesn't make sense",
    ];
    return correctionMarkers.some((m) => t.includes(m));
}
export function getNextCanonicalPrompt(currentCanonical, prompt) {
    if (isFeedbackOrCorrectionPrompt(prompt))
        return currentCanonical ?? prompt;
    return prompt;
}
//# sourceMappingURL=vanna_prompt_utils.js.map