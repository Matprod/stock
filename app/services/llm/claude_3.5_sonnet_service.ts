import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { GenerateResponseParams, LLMService } from './llm_service.js'
import env from '#start/env'
import { findJsonStringFieldMarker, forwardJsonStringChars } from '#utils/chatbot_result'

export class Claude35SonnetService implements LLMService {
  private client: BedrockRuntimeClient
  private readonly modelId: string
  private readonly MAX_TOKENS = 8000

  constructor(modelId = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0') {
    this.modelId = modelId
    const config = {
      region: 'eu-west-3',
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
    responseFormat = 'json',
    maxTokens,
  }: GenerateResponseParams): Promise<string> {
    try {
      const body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens ?? this.MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: dataPrompt,
                cache_control: { type: 'ephemeral' },
              },
            ],
          },
          ...history,
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
          ...(responseFormat === 'json'
            ? [{ role: 'assistant' as const, content: [{ type: 'text' as const, text: '{' }] }]
            : []),
        ],
      }

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      })

      const response = await this.client.send(command)
      const json = JSON.parse(Buffer.from(response.body).toString('utf-8'))

      if (!json.content?.[0]?.text) {
        throw new Error('Empty response from Claude 4 Sonnet')
      }

      return responseFormat === 'json' ? '{' + json.content[0].text : json.content[0].text
    } catch (error) {
      console.error('Error generating response from Claude 4 Sonnet:', error)
      throw new Error(
        `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async generateResponseStream(
    { systemPrompt, dataPrompt, prompt, history }: GenerateResponseParams,
    onToken: (token: string) => void
  ): Promise<{ raw: string; extractedResponse: string }> {
    const body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: this.MAX_TOKENS,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: dataPrompt, cache_control: { type: 'ephemeral' } }],
        },
        ...history,
        { role: 'user', content: [{ type: 'text', text: prompt }] },
        { role: 'assistant', content: [{ type: 'text', text: '{' }] },
      ],
    }

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    })

    const rawStream = await this.client.send(command)
    const decoder = new TextDecoder()

    // Accumulated = prefill `{` + all streamed continuation = full JSON string
    let accumulated = '{'
    let extractedResponse = ''
    const collect = (token: string) => {
      extractedResponse += token
      onToken(token)
    }

    let state: 'preamble' | 'in_value' | 'done' = 'preamble'
    let escaped = false
    let pendingQuote = false

    for await (const event of rawStream.body!) {
      if (!event.chunk?.bytes) continue
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(decoder.decode(event.chunk.bytes)) as Record<string, unknown>
      } catch {
        continue
      }
      if (parsed.type !== 'content_block_delta') continue
      const delta = parsed.delta as { type: string; text?: string }
      if (delta.type !== 'text_delta' || !delta.text) continue

      const chunk = delta.text
      accumulated += chunk

      if (state === 'preamble') {
        const marker = findJsonStringFieldMarker(accumulated, 'response')
        if (!marker) continue
        state = 'in_value'
        const afterMarker = accumulated.slice(marker.start + marker.len)
        ;({ escaped, state, pendingQuote } = forwardJsonStringChars(
          afterMarker,
          escaped,
          state,
          collect,
          pendingQuote
        ))
      } else if (state === 'in_value') {
        ;({ escaped, state, pendingQuote } = forwardJsonStringChars(
          chunk,
          escaped,
          state,
          collect,
          pendingQuote
        ))
      }
    }

    return { raw: accumulated, extractedResponse }
  }

  async generateTitle(systemPrompt: string, prompt: string): Promise<string> {
    try {
      const body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 50,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
      })

      const response = await this.client.send(command)
      const json = JSON.parse(Buffer.from(response.body).toString('utf-8'))

      if (!json.content?.[0]?.text) {
        throw new Error('Empty response from Claude 4 Sonnet')
      }

      return json.content[0].text
    } catch (error) {
      console.error('Error generating title from Claude 4 Sonnet:', error)
      throw new Error(
        `Failed to generate title: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
