export interface GenerateResponseParams {
  systemPrompt: string
  prompt: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  dataPrompt: string
  responseFormat?: 'json' | 'text'
  maxTokens?: number
}

export interface LLMService {
  generateResponse(params: GenerateResponseParams): Promise<string>
}
