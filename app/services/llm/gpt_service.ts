import { BedrockRuntimeClient, ConverseCommand, ConversationRole, Message } from '@aws-sdk/client-bedrock-runtime'
import { GenerateResponseParams, LLMService } from '#services/llm/llm_service'
import env from '#start/env'

export class GPTService implements LLMService {
  private client: BedrockRuntimeClient
  private modelId = 'openai.gpt-oss-120b-1:0'
  // private readonly MAX_TOKENS = 2000

  constructor() {
    const config = {
      region: 'eu-west-2', // for London region
      credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY'),
        secretAccessKey: env.get('AWS_SECRET_KEY'),
      },
    }

    this.client = new BedrockRuntimeClient(config)
  }

  async generateResponse({
    systemPrompt,
    dataPrompt,
    prompt,
    history,
  }: GenerateResponseParams): Promise<string> {
    try {
      const messages: Message[] = [
        {
          role: ConversationRole.USER,
          content: [
            {
              text: `Additional context:\n${dataPrompt}\n User prompt:\n${prompt}`,
              // text: `${prompt}\nAdditional context:\n${dataPrompt}`,
            },
          ],
        },
      ]

      // Add history messages if provided
      if (history && history.length > 0) {
        const historyMessages: Message[] = history.map((msg) => ({
          role: msg.role === 'assistant' ? ConversationRole.ASSISTANT : ConversationRole.USER,
          content: [
            {
              text: msg.content,
            },
          ],
        }))
        messages.unshift(...historyMessages)
      }

      const command = new ConverseCommand({
        modelId: this.modelId,
        messages,
        inferenceConfig: {
          temperature: history.length > 0 ? 0.1 : 0.3,
          topP: history.length > 0 ? 0.95 : 0.9,
        },
        system: [
          {
            text: systemPrompt,
          },
        ]
      })

      const response = await this.client.send(command)
      let finalResponse = '';
      for (const message of response.output?.message?.content || []) {
        if (message.text) {
          finalResponse += message.text;
        }
      }
      return finalResponse;
    } catch (error) {
      console.error('Error generating response from GPT:', error)
      throw new Error(
        `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async generateTitle(systemPrompt: string, prompt: string): Promise<string> {
    try {
      const messages: Message[] = [
        {
          role: ConversationRole.USER,
          content: [
            {
              text: `${systemPrompt}\n\n${prompt}`,
            },
          ],
        },
      ]

      const command = new ConverseCommand({
        modelId: this.modelId,
        messages,
        inferenceConfig: {
          temperature: 0.7,
          topP: 0.9,
        },
      })

      const response = await this.client.send(command)
      let finalResponse = '';
      for (const message of response.output?.message?.content || []) {
        if (message.text) {
          finalResponse += message.text;
        }
      }
      if (!finalResponse) {
        throw new Error('Empty response from GPT')
      }

      return finalResponse
    } catch (error) {
      console.error('Error generating title from GPT:', error)
      throw new Error(
        `Failed to generate title: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
