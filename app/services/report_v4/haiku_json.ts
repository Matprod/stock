import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { HAIKU_ROUTER_MODEL_ID } from '#constants/question_router.constants'
import env from '#start/env'

const bedrockClient = new BedrockRuntimeClient({
  region: env.get('AWS_REGION'),
  credentials: {
    accessKeyId: env.get('AWS_ACCESS_KEY'),
    secretAccessKey: env.get('AWS_SECRET_KEY'),
  },
})

export const invokeHaikuJson = async <T extends Record<string, unknown>>(args: {
  system: string
  user: string
  maxTokens?: number
}): Promise<T> => {
  const raw = await bedrockClient.send(
    new InvokeModelCommand({
      modelId: HAIKU_ROUTER_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: args.maxTokens ?? 400,
        system: args.system,
        messages: [{ role: 'user', content: args.user }],
      }),
    })
  )
  const json = JSON.parse(Buffer.from(raw.body).toString('utf-8')) as {
    content?: Array<{ text?: string }>
  }
  const rawText = json.content?.[0]?.text ?? '{}'
  const cleaned = rawText
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error(`No JSON in Haiku response. Raw text: ${rawText.slice(0, 300)}`)
  }
  return JSON.parse(match[0]) as T
}
