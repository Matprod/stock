import Prompt from '#models_pg/prompt'
import env from '#start/env'
import Groq from 'groq-sdk'
import { GenerateResponseParams, LLMService } from './llm_service.js'
import { ChatCategory, ClassificationResult, CHAT_CATEGORIES } from '#contracts/chatbot'

export class GroqService implements LLMService {
  private client: Groq
  private readonly model = 'llama-3.3-70b-versatile'
  private readonly MAX_TOKENS = 2000
  private static readonly CATEGORIES = CHAT_CATEGORIES

  constructor() {
    this.client = new Groq({ apiKey: env.get('GROQ_API_KEY') })
  }

  async generateResponse({
    systemPrompt,
    dataPrompt,
    prompt,
    history,
  }: GenerateResponseParams): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        max_tokens: this.MAX_TOKENS,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: dataPrompt },
          ...history,
          { role: 'user', content: prompt },
        ],
      })

      const content = response.choices?.[0]?.message?.content?.trim()
      if (!content) {
        throw new Error('Empty response from Groq')
      }

      return content
    } catch (error) {
      console.error('Error generating response from Groq:', error)
      throw new Error(
        `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async generateTitle(systemPrompt: string, prompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.7,
        max_tokens: 50,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      })

      const content = response.choices?.[0]?.message?.content?.trim()
      if (!content) {
        throw new Error('Empty response from Groq')
      }

      return content
    } catch (error) {
      console.error('Error generating title from Groq:', error)
      throw new Error(
        `Failed to generate title: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  public async classify(
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    language: string
  ): Promise<ClassificationResult> {
    try {
      const system = await Prompt.findBy('title', 'chatbot-classification')
      if (!system) {
        throw new Error('Prompt non trouvé')
      }
      let systemContent = (system.content || '').toString()
      const languageText = language === 'fr' ? 'French' : 'English'
      systemContent =
        'Respond in ' +
        languageText +
        '. /n' +
        systemContent +
        '\n The History of the conversation is \n' +
        history.map((h) => `${h.role}: ${h.content}`).join('\n')
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: text },
        ],
      })
      const raw = response.choices?.[0]?.message?.content?.trim()
      const content = raw ?? ''
      try {
        const jsonMatch = content.match(/\[[\s\S]*?\]/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (Array.isArray(parsed)) {
            const categories = parsed
              .filter((value) => typeof value === 'string')
              .map((value) => (value as string).toLowerCase())
              .filter((value) =>
                CHAT_CATEGORIES.includes(value as Exclude<ChatCategory, 'general'>)
              ) as Exclude<ChatCategory, 'general'>[]

            if (categories.length > 0) {
              return { kind: 'categories', categories }
            }
          }
        }
      } catch (error) {
        console.log('JSON parsing error:', error, 'Raw content:', content)
      }

      const possibleList = content
        .toLowerCase()
        .split(',')
        .map((c) => c.trim())
      const recognized = possibleList.filter((c) =>
        CHAT_CATEGORIES.includes(c as Exclude<ChatCategory, 'general'>)
      )

      if (recognized.length > 0 && recognized.length === possibleList.length) {
        return { kind: 'categories', categories: recognized as Exclude<ChatCategory, 'general'>[] }
      }

      if (content.length > 0) {
        const lowerContent = content.toLowerCase()
        const categories = GroqService.CATEGORIES.filter((category) =>
          lowerContent.includes(category)
        )

        if (categories.length > 0) {
          return { kind: 'categories', categories }
        }
      }
      return {
        kind: 'general',
        response:
          content.length > 0
            ? content
            : language === 'fr'
              ? 'Désolé, réessaye'
              : 'Sorry, try again',
      }
    } catch (error) {
      console.error('Error classifying with Groq:', error)
      return {
        kind: 'general',
        response: language === 'fr' ? 'Désolé, réessaye' : 'Sorry, try again',
      }
    }
  }
}
