export const CHATBOT_QUESTION_CATEGORY = {
  PERFORMANCE: 'performance',
  INJURY: 'injury',
} as const

export type ChatbotQuestionCategory = (typeof CHATBOT_QUESTION_CATEGORY)[keyof typeof CHATBOT_QUESTION_CATEGORY]

export const CHATBOT_QUESTION_TYPE = {
  ATHLETE: 'athlete',
  TEAM: 'team',
  USER: 'user',
} as const

export type ChatbotQuestionType = (typeof CHATBOT_QUESTION_TYPE)[keyof typeof CHATBOT_QUESTION_TYPE]