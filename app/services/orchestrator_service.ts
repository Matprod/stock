import Prompt from '#models_pg/prompt'
import { GPTService } from '#services/llm/gpt_service'

type OrchestratorInput = {
  date: string
  prompt: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  pieces: Array<{ name: string; content: string }>
  militaryContext?: string
  language: string
}

export default class OrchestratorService {
  private llm = new GPTService()

  public async summarize({
    date,
    prompt,
    history,
    pieces,
    language,
  }: OrchestratorInput): Promise<string> {
    const systemPrompt = await Prompt.findBy('title', 'orchestrator_system_prompt')
    if (!systemPrompt) {
      throw new Error('Prompt non trouvé')
    }
    let systemPromptContent = systemPrompt.content

    systemPromptContent = 'Today is ' + date + '. ' + systemPromptContent
    systemPromptContent = systemPromptContent.replaceAll(
      '{{language}}',
      language === 'fr' ? 'French' : 'English'
    )

    let dataPrompt = ''
    if (pieces.length > 0) {
      pieces.forEach((p) => {
        if (p.name === 'military_context') {
          dataPrompt += `Military context:\n${p.content}\n\n Expert Responses:\n`
        } else {
          dataPrompt += `- ${p.name}:\n${p.content}\n`
        }
      })
    }

    return this.llm.generateResponse({
      systemPrompt: systemPromptContent,
      dataPrompt,
      prompt,
      history,
    })
  }
}
