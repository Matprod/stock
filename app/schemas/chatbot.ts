import vine from '@vinejs/vine'
import {
  CHATBOT_QUESTION_CATEGORY,
  CHATBOT_QUESTION_TYPE,
} from '#constants/chatbot_questions.constants'
import { INSIGHT_CATEGORIES } from '#constants/insight.constants'

export const chatbotSchema = vine.compile(
  vine.object({
    prompt: vine.string(),
    athleteId: vine.string(),
    date: vine.string(),
    discussionId: vine.string().nullable(),
    category: vine.enum(INSIGHT_CATEGORIES),
  })
)

export const teamChatbotSchema = vine.compile(
  vine.object({
    prompt: vine.string(),
    date: vine.string(),
    discussionId: vine.string().nullable(),
  })
)

export const generateQuestionsSchema = vine.compile(
  vine.object({
    date: vine.string(),
  })
)

export const generateQuestionsParamsSchema = vine.compile(
  vine.object({
    athleteId: vine.string(),
  })
)

export const getQuestionsParamsSchema = vine.compile(
  vine.object({
    athleteId: vine.string(),
  })
)

export const getQuestionsQuerySchema = vine.compile(
  vine.object({
    type: vine.enum(Object.values(CHATBOT_QUESTION_TYPE)).optional(),
    category: vine.enum(Object.values(CHATBOT_QUESTION_CATEGORY)).optional(),
    limit: vine.number().optional(),
  })
)

export const getReportQuerySchema = vine.compile(
  vine.object({
    athleteId: vine.string(),
    date: vine.string(),
    category: vine.enum(INSIGHT_CATEGORIES),
  })
)

export const generateDailyReportsSchema = vine.compile(
  vine.object({
    athleteId: vine.string(),
    date: vine.string(),
  })
)
