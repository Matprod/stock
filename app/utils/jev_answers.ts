export const noulScore = (answers: Record<string, unknown>, key: string): number =>
  (answers[key] as { noul?: number } | undefined)?.noul ?? 0

export const choiceValue = (answers: Record<string, unknown>, key: string): string | undefined => {
  const answer = answers[key] as { choice?: string } | undefined
  return typeof answer?.choice === 'string' ? answer.choice : undefined
}
