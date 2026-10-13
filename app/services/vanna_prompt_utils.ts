export function normalizePrompt(text: string): string {
  return text.trim().toLowerCase()
}

export function isFeedbackOrCorrectionPrompt(prompt: string): boolean {
  const t = normalizePrompt(prompt)
  if (!t) return true

  // Short acknowledgements / fillers
  if (t.length <= 8) return true

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
  ]

  if (feedback.some((w) => t === w)) return true

  const correctionMarkers = [
    // FR
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
    // EN
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
  ]

  return correctionMarkers.some((m) => t.includes(m))
}

export function getNextCanonicalPrompt(currentCanonical: string | null, prompt: string): string {
  if (isFeedbackOrCorrectionPrompt(prompt)) return currentCanonical ?? prompt
  return prompt
}

