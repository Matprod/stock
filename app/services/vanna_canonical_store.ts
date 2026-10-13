import { getNextCanonicalPrompt } from '#services/vanna_prompt_utils'

const canonicalByDiscussionId = new Map<string, string>()

export function getCanonicalPrompt(discussionId: string): string | null {
  return canonicalByDiscussionId.get(discussionId) ?? null
}

export function updateCanonicalPrompt(discussionId: string, prompt: string): string {
  const current = getCanonicalPrompt(discussionId)
  const next = getNextCanonicalPrompt(current, prompt)
  canonicalByDiscussionId.set(discussionId, next)
  return next
}

export function clearCanonicalPrompt(discussionId: string): void {
  canonicalByDiscussionId.delete(discussionId)
}

