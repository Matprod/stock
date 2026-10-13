export const ROUTER_CLASSIFIER_PROMPT_TITLE = 'router-classifier'

export const ROUTER_ROUTE = {
  CHATBOT_ML: 'chatbot_ml',
  AGENT: 'agent',
} as const

export type RouterRoute = (typeof ROUTER_ROUTE)[keyof typeof ROUTER_ROUTE]

export const ROUTER_PROVIDER = {
  HAIKU: 'haiku',
  JEV: 'jev',
} as const

export type RouterProvider = (typeof ROUTER_PROVIDER)[keyof typeof ROUTER_PROVIDER]

export const JEV_ROUTER_MODEL = 'jev-latest'

export const HAIKU_ROUTER_MODEL_ID = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'
